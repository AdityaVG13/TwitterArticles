import { DEFAULT_OPTIONS } from "./config.js";

const singleView = document.querySelector("#singleView");
const batchView = document.querySelector("#batchView");
const modeSingleBtn = document.querySelector("#modeSingle");
const modeBatchBtn = document.querySelector("#modeBatch");
const captureSingleBtn = document.querySelector("#captureSingleBtn");
const addTabBtn = document.querySelector("#addTabBtn");
const saveZipBtn = document.querySelector("#saveZipBtn");
const clearBtn = document.querySelector("#clearBtn");
const queueList = document.querySelector("#queueList");
const queueCount = document.querySelector("#queueCount");
const statusEl = document.querySelector("#status");
const openOptions = document.querySelector("#openOptions");
const formatChips = batchView.querySelectorAll(".chip");

const stored = await chrome.storage.sync.get(DEFAULT_OPTIONS);
let captureMode = stored.captureMode || DEFAULT_OPTIONS.captureMode;
const initialFormats =
  Array.isArray(stored.formats) && stored.formats.length
    ? stored.formats
    : DEFAULT_OPTIONS.formats;

for (const chip of formatChips) {
  const input = chip.querySelector("input");
  input.checked = initialFormats.includes(input.value);
  syncChipState(chip);
  input.addEventListener("change", () => {
    syncChipState(chip);
    saveFormats();
  });
}

renderMode();
await renderQueue();

modeSingleBtn.addEventListener("click", () => switchMode("single"));
modeBatchBtn.addEventListener("click", () => switchMode("batch"));

captureSingleBtn.addEventListener("click", async () => {
  await runWithStatus("Capturing...", async () => {
    const result = await sendMessage({ type: "capture:single" });
    if (!result?.ok) {
      throw new Error(result?.error || "Capture failed.");
    }
    setStatus(`Saved ${result.files?.length || 0} file(s).`, "success");
    setTimeout(() => window.close(), 700);
  });
});

addTabBtn.addEventListener("click", async () => {
  await runWithStatus("Adding tab...", async () => {
    const result = await sendMessage({ type: "capture:queue" });
    if (!result?.ok) {
      throw new Error(result?.error || "Could not add tab.");
    }
    setStatus(result.duplicate ? "Already in queue." : "Added.", "success");
    await renderQueue();
  });
});

saveZipBtn.addEventListener("click", async () => {
  await runWithStatus("Saving ZIP...", async () => {
    const result = await sendMessage({ type: "batch:save" });
    if (!result?.ok) {
      throw new Error(result?.error || "Save failed.");
    }
    const failed = result.failures?.length || 0;
    const ok = result.successes?.length || 0;
    setStatus(
      failed
        ? `Saved ${ok} article(s), ${failed} failed. ZIP downloaded.`
        : `Saved ${ok} article(s). ZIP downloaded.`,
      failed ? "" : "success"
    );
    await renderQueue();
  });
});

clearBtn.addEventListener("click", async () => {
  await sendMessage({ type: "batch:clear" });
  await renderQueue();
  setStatus("Queue cleared.");
});

openOptions.addEventListener("click", (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

async function switchMode(mode) {
  captureMode = mode;
  await chrome.storage.sync.set({ captureMode: mode });
  renderMode();
  setStatus("");
}

function renderMode() {
  modeSingleBtn.setAttribute("aria-pressed", String(captureMode === "single"));
  modeBatchBtn.setAttribute("aria-pressed", String(captureMode === "batch"));
  singleView.hidden = captureMode !== "single";
  batchView.hidden = captureMode !== "batch";
}

async function renderQueue() {
  const result = await sendMessage({ type: "batch:list" });
  const queue = Array.isArray(result?.queue) ? result.queue : [];
  queueCount.textContent =
    queue.length === 1 ? "1 in queue" : `${queue.length} in queue`;
  queueList.replaceChildren();

  for (const entry of queue) {
    const li = document.createElement("li");
    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = entry.article?.title || "Untitled";
    title.title = entry.article?.title || "";
    const byline = document.createElement("span");
    byline.className = "byline";
    byline.textContent =
      entry.article?.byline || extractAuthor(entry.article?.sourceUrl) || "";
    meta.append(title, byline);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon";
    remove.setAttribute("aria-label", `Remove ${entry.article?.title || ""}`);
    remove.textContent = "×";
    remove.addEventListener("click", async () => {
      await sendMessage({ type: "batch:remove", id: entry.id });
      await renderQueue();
    });

    li.append(meta, remove);
    queueList.append(li);
  }

  saveZipBtn.disabled = queue.length === 0;
  clearBtn.disabled = queue.length === 0;
  saveZipBtn.textContent =
    queue.length === 0
      ? "Save to ZIP"
      : queue.length === 1
        ? "Save 1 article as ZIP"
        : `Save ${queue.length} articles as ZIP`;
}

function syncChipState(chip) {
  const input = chip.querySelector("input");
  chip.classList.toggle("is-active", input.checked);
}

function extractAuthor(url) {
  if (!url) return "";
  try {
    const username = new URL(url).pathname.split("/").filter(Boolean)[0];
    return username ? `@${username}` : "";
  } catch {
    return "";
  }
}

async function saveFormats() {
  const formats = [...formatChips]
    .map((chip) => chip.querySelector("input"))
    .filter((input) => input.checked)
    .map((input) => input.value);
  if (formats.length) {
    await chrome.storage.sync.set({ formats });
  }
}

function setStatus(message, tone = "") {
  statusEl.textContent = message;
  statusEl.className = tone;
}

async function runWithStatus(pendingMessage, work) {
  setStatus(pendingMessage);
  setBusy(true);
  try {
    await work();
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  for (const button of [captureSingleBtn, addTabBtn, saveZipBtn, clearBtn]) {
    if (button) button.disabled = busy;
  }
  if (!busy) {
    renderQueue().catch(() => {});
  }
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

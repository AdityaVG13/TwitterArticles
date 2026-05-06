const DEFAULT_OPTIONS = {
  serverOrigin: "http://127.0.0.1:4512",
  serverMode: "native",
  formats: ["md"],
  zip: true,
};

const form = document.querySelector("#optionsForm");
const status = document.querySelector("#status");
const startServer = document.querySelector("#startServer");
const stopServer = document.querySelector("#stopServer");
const testServer = document.querySelector("#testServer");

const stored = await chrome.storage.sync.get(DEFAULT_OPTIONS);
const local = await chrome.storage.local.get({ lastError: "" });
form.serverOrigin.value = stored.serverOrigin || DEFAULT_OPTIONS.serverOrigin;
form.querySelector(
  `input[name="serverMode"][value="${stored.serverMode || DEFAULT_OPTIONS.serverMode}"]`
).checked = true;
for (const input of form.querySelectorAll('input[name="formats"]')) {
  input.checked = (stored.formats || DEFAULT_OPTIONS.formats).includes(
    input.value
  );
}
form.zip.checked = stored.zip !== false;
if (local.lastError) {
  setStatus(local.lastError, true);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formats = [
    ...form.querySelectorAll('input[name="formats"]:checked'),
  ].map((input) => input.value);
  if (!formats.length) {
    setStatus("Pick at least one format.", true);
    return;
  }

  await chrome.storage.sync.set({
    serverOrigin: form.serverOrigin.value.trim().replace(/\/$/, ""),
    serverMode: form.querySelector('input[name="serverMode"]:checked').value,
    formats,
    zip: form.zip.checked,
  });
  setStatus("Saved.");
});

startServer.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "server:start" });
  if (!response?.ok) {
    setStatus(response?.error || "Server start failed.", true);
    return;
  }

  setStatus(`Server running at ${response.origin || form.serverOrigin.value}.`);
});

testServer.addEventListener("click", async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "server:status",
    });
    if (!response?.ok) {
      throw new Error(response?.error || "No status response");
    }

    if (!response.server) {
      setStatus("Managed server is not running.");
      return;
    }

    const pid = response.server?.pid ? ` pid=${response.server.pid}` : "";
    const idle = response.server?.idleMs
      ? ` idle=${Math.round(response.server.idleMs / 1000)}s`
      : "";
    setStatus(`Server is reachable.${pid}${idle}`);
  } catch (error) {
    setStatus(`Server test failed: ${error.message}`, true);
  }
});

stopServer.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "server:stop" });
  if (!response?.ok) {
    setStatus(response?.error || "Server stop failed.", true);
    return;
  }

  setStatus("Managed server stopped.");
});

function setStatus(message, isError = false) {
  status.textContent = message;
  status.className = isError ? "error" : "";
}

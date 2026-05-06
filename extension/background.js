const DEFAULT_OPTIONS = {
  serverOrigin: "http://127.0.0.1:4512",
  serverMode: "native",
  formats: ["md"],
  zip: true,
};
const NATIVE_HOST_NAME = "org.x_article_downloader.native_host";

let nativePort = null;
let nativeRequestId = 0;
let nativeRequests = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(DEFAULT_OPTIONS, (stored) => {
    chrome.storage.sync.set({ ...DEFAULT_OPTIONS, ...stored }, () => {
      keepServerAlive().catch((error) => rememberNativeError(error));
    });
  });
});

chrome.runtime.onStartup.addListener(() => {
  keepServerAlive().catch((error) => rememberNativeError(error));
});

chrome.runtime.onSuspend.addListener(() => {
  disconnectNativeHost();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleRuntimeMessage(message).then(sendResponse, (error) => {
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});

chrome.action.onClicked.addListener(async (tab) => {
  await setBadge("...");
  try {
    if (!tab.id || !isXUrl(tab.url || "")) {
      throw new Error("Open an x.com Article/status tab first.");
    }

    const options = await getOptions();
    const serverOrigin = await ensureServer(options);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/extract-page.js"],
    });
    const [capture] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.__xadExtractPage(),
    });

    if (!capture?.result?.ok) {
      throw new Error(
        capture?.result?.error || "Could not capture page content."
      );
    }

    const response = await fetch(`${serverOrigin}/api/save-capture`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        article: capture.result.article,
        formats: options.formats,
        zip: options.zip,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Server returned ${response.status}`);
    }

    const files = result.zip ? [result.zip] : result.success.files;
    for (const file of files) {
      const absoluteUrl = new URL(file.url, serverOrigin).toString();
      await chrome.downloads.download({
        url: absoluteUrl,
        filename: file.name,
        saveAs: false,
      });
    }
    await setBadge("OK");
  } catch (error) {
    console.error(error);
    await setBadge("ERR");
    await chrome.storage.local.set({ lastError: error.message });
    await chrome.runtime.openOptionsPage();
  } finally {
    setTimeout(() => setBadge(""), 2500);
  }
});

async function getOptions() {
  const stored = await chrome.storage.sync.get(DEFAULT_OPTIONS);
  return {
    serverOrigin: String(
      stored.serverOrigin || DEFAULT_OPTIONS.serverOrigin
    ).replace(/\/$/, ""),
    serverMode: stored.serverMode || DEFAULT_OPTIONS.serverMode,
    formats:
      Array.isArray(stored.formats) && stored.formats.length
        ? stored.formats
        : DEFAULT_OPTIONS.formats,
    zip: stored.zip !== false,
  };
}

async function ensureServer(options = null) {
  const resolved = options || (await getOptions());
  if (resolved.serverMode === "manual") {
    return resolved.serverOrigin;
  }

  const url = new URL(resolved.serverOrigin);
  const response = await nativeRequest(
    {
      type: "ensureStarted",
      origin: resolved.serverOrigin,
      port: Number(url.port || 80),
    },
    20000
  );

  if (!response.ok) {
    throw new Error(
      response.error || "Native host could not start the server."
    );
  }

  await chrome.storage.local.remove("lastError");
  return response.origin || resolved.serverOrigin;
}

async function keepServerAlive() {
  const options = await getOptions();
  if (options.serverMode === "manual") {
    return { ok: true, manual: true };
  }

  return {
    ok: true,
    origin: await ensureServer(options),
  };
}

async function handleRuntimeMessage(message) {
  if (message?.type === "server:start") {
    return keepServerAlive();
  }

  if (message?.type === "server:status") {
    const options = await getOptions();
    if (options.serverMode === "manual") {
      const response = await fetch(`${options.serverOrigin}/health`);
      return { ok: response.ok, manual: true, server: await response.json() };
    }

    const response = await nativeRequest(
      { type: "status", origin: options.serverOrigin },
      5000
    );
    return {
      ...response,
      running: Boolean(response.server),
    };
  }

  if (message?.type === "server:stop") {
    const response = await nativeRequest({ type: "stop" }, 5000).catch(
      (error) => ({ ok: false, error: error.message })
    );
    disconnectNativeHost();
    return response;
  }

  throw new Error(`Unknown message: ${message?.type || "missing type"}`);
}

function connectNativeHost() {
  if (nativePort) {
    return nativePort;
  }

  nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
  nativePort.onMessage.addListener((message) => {
    const pending = nativeRequests.get(message.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    nativeRequests.delete(message.id);
    pending.resolve(message);
  });
  nativePort.onDisconnect.addListener(() => {
    const error =
      chrome.runtime.lastError?.message || "Native host disconnected.";
    const pending = [...nativeRequests.values()];
    nativeRequests = new Map();
    nativePort = null;

    for (const request of pending) {
      clearTimeout(request.timeout);
      request.reject(new Error(error));
    }
  });
  return nativePort;
}

function nativeRequest(message, timeoutMs) {
  return new Promise((resolve, reject) => {
    const port = connectNativeHost();
    const id = `${Date.now()}-${++nativeRequestId}`;
    const timeout = setTimeout(() => {
      nativeRequests.delete(id);
      reject(
        new Error(
          "Native host timed out. Run `npm run install-native`, then reload the extension."
        )
      );
    }, timeoutMs);

    nativeRequests.set(id, { resolve, reject, timeout });
    try {
      port.postMessage({ ...message, id });
    } catch (error) {
      clearTimeout(timeout);
      nativeRequests.delete(id);
      reject(error);
    }
  });
}

function disconnectNativeHost() {
  if (nativePort) {
    nativePort.disconnect();
    nativePort = null;
  }
}

function rememberNativeError(error) {
  chrome.storage.local.set({ lastError: error.message });
}

function isXUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    return (
      host === "x.com" ||
      host === "twitter.com" ||
      host === "mobile.twitter.com"
    );
  } catch {
    return false;
  }
}

async function setBadge(text) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({
    color: text === "ERR" ? "#9f1d2f" : "#005f73",
  });
}

const form = document.querySelector("#downloadForm");
const urls = document.querySelector("#urls");
const status = document.querySelector("#status");
const button = document.querySelector("#submitButton");
const bookmarklet = document.querySelector("#bookmarklet");

const currentUrl = new URL(location.href);
const incomingUrl = currentUrl.searchParams.get("url");
if (incomingUrl) {
  urls.value = incomingUrl;
}

bookmarklet.href = `javascript:(()=>{open('${location.origin}/?url='+encodeURIComponent(location.href),'_blank')})()`;
bookmarklet.title =
  "Drag this link to your bookmarks bar, then click it from an X Article.";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formats = [
    ...form.querySelectorAll('input[name="formats"]:checked'),
  ].map((item) => item.value);
  const payload = {
    urls: urls.value,
    formats,
    zip: form.querySelector('input[name="zip"]').checked,
  };

  setBusy(true);
  renderStatus(messageNode("Working. Keep this tab open."));

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    renderResult(result);
  } catch (error) {
    renderStatus(messageNode(error.message, "error"));
  } finally {
    setBusy(false);
  }
});

function renderResult(result) {
  const nodes = [];

  if (result.zip) {
    nodes.push(downloadLink(result.zip, "Download zip", "download"));
  }

  for (const success of result.successes || []) {
    const article = document.createElement("article");
    article.className = "result";

    const heading = document.createElement("h2");
    heading.textContent = success.title || "Exported article";

    const links = document.createElement("div");
    links.className = "links";
    links.replaceChildren(
      ...(success.files || []).map((file) => downloadLink(file))
    );

    article.replaceChildren(heading, links);
    nodes.push(article);
  }

  for (const failure of result.failures || []) {
    const article = document.createElement("article");
    article.className = "result failed";

    const heading = document.createElement("h2");
    heading.textContent = failure.url || "Failed URL";

    const message = document.createElement("p");
    message.textContent = failure.error || "Export failed.";

    article.replaceChildren(heading, message);
    nodes.push(article);
  }

  if (!nodes.length) {
    nodes.push(messageNode(result.error || "No files created.", "error"));
  }

  renderStatus(...nodes);
}

function setBusy(isBusy) {
  button.disabled = isBusy;
  button.textContent = isBusy ? "Downloading..." : "Download";
}

function renderStatus(...nodes) {
  status.replaceChildren(...nodes);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function downloadLink(
  file,
  fallbackLabel = file?.name || "Download",
  className = ""
) {
  const link = document.createElement("a");
  const bytes = formatBytes(file?.bytes);
  link.textContent = bytes ? `${fallbackLabel} (${bytes})` : fallbackLabel;
  if (className) {
    link.className = className;
  }

  const href = safeDownloadHref(file?.url);
  if (href) {
    link.href = href;
  } else {
    link.textContent = `${link.textContent} (invalid link)`;
  }

  return link;
}

function messageNode(message, className = "") {
  const node = document.createElement("p");
  node.textContent = message;
  if (className) {
    node.className = className;
  }

  return node;
}

function safeDownloadHref(value) {
  try {
    const url = new URL(String(value || ""), location.origin);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith("/downloads/")
    ) {
      return "";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "";
  }
}

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
  renderStatus("<p>Working. Keep this tab open.</p>");

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    renderResult(result);
  } catch (error) {
    renderStatus(`<p class="error">${escapeHtml(error.message)}</p>`);
  } finally {
    setBusy(false);
  }
});

function renderResult(result) {
  const parts = [];

  if (result.zip) {
    parts.push(
      `<a class="download" href="${result.zip.url}">Download zip (${formatBytes(result.zip.bytes)})</a>`
    );
  }

  for (const success of result.successes || []) {
    const links = success.files
      .map(
        (file) =>
          `<a href="${file.url}">${escapeHtml(file.name)} (${formatBytes(file.bytes)})</a>`
      )
      .join("");
    parts.push(
      `<article class="result"><h2>${escapeHtml(success.title)}</h2><div class="links">${links}</div></article>`
    );
  }

  for (const failure of result.failures || []) {
    parts.push(
      `<article class="result failed"><h2>${escapeHtml(failure.url)}</h2><p>${escapeHtml(failure.error)}</p></article>`
    );
  }

  if (!parts.length) {
    parts.push(
      `<p class="error">${escapeHtml(result.error || "No files created.")}</p>`
    );
  }

  renderStatus(parts.join(""));
}

function setBusy(isBusy) {
  button.disabled = isBusy;
  button.textContent = isBusy ? "Downloading..." : "Download";
}

function renderStatus(html) {
  status.innerHTML = html;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

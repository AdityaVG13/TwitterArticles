import sanitize from "sanitize-filename";

const TRAILING_PUNCTUATION = /[),.;\]]+$/;

export function parseUrlInput(input) {
  if (Array.isArray(input)) {
    return input.flatMap((item) => parseUrlInput(item));
  }

  return String(input ?? "")
    .split(/[\s,]+/)
    .map((value) =>
      value.trim().replace(/^<|>$/g, "").replace(TRAILING_PUNCTUATION, "")
    )
    .filter(Boolean);
}

export function isXHost(hostname) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return (
    host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com"
  );
}

export function normalizeSourceUrl(rawUrl, options = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }

  if (!options.allowAnyHost && !isXHost(url.hostname)) {
    throw new Error(`Only x.com and twitter.com URLs are accepted: ${rawUrl}`);
  }

  if (url.hostname.toLowerCase().replace(/^www\./, "") === "twitter.com") {
    url.hostname = "x.com";
  }

  url.hash = "";
  return url.toString();
}

export function fileStemForArticle(article) {
  const title = cleanFilePart(article.title || "x-article", 96);
  const author = cleanFilePart(
    article.byline ||
      authorFromUrl(article.sourceUrl || article.finalUrl || ""),
    48
  );
  return [title || "x-article", author].filter(Boolean).join(" - ");
}

export function parseFormats(input) {
  const values = Array.isArray(input)
    ? input
    : String(input ?? "md").split(",");
  const formats = values
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(formats)];
  const allowed = new Set(["md", "pdf", "docx"]);

  for (const format of unique) {
    if (!allowed.has(format)) {
      throw new Error(`Unsupported format: ${format}`);
    }
  }

  return unique.length ? unique : ["md"];
}

function authorFromUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const username = url.pathname.split("/").filter(Boolean)[0];
    return username ? `@${username}` : "";
  } catch {
    return "";
  }
}

function cleanFilePart(value, maxLength) {
  return sanitize(String(value || ""))
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim()
    .slice(0, maxLength)
    .trim();
}

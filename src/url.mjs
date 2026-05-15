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
  const title = cleanFilePart(article.title || "", 96);
  const author = cleanFilePart(
    article.byline ||
      authorFromUrl(article.sourceUrl || article.finalUrl || ""),
    48
  );
  const safeTitle = title || fallbackStem(article);
  return [safeTitle, author].filter(Boolean).join(" - ");
}

function fallbackStem(article) {
  const tweetId = tweetIdFromUrl(article.sourceUrl || article.finalUrl || "");
  return tweetId ? `x-article-${tweetId}` : "x-article";
}

function tweetIdFromUrl(rawUrl) {
  try {
    const segments = new URL(rawUrl).pathname.split("/").filter(Boolean);
    const statusIndex = segments.indexOf("status");
    const id = statusIndex >= 0 ? segments[statusIndex + 1] : "";
    return /^\d{1,32}$/.test(id) ? id : "";
  } catch {
    return "";
  }
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

const CHROME_FORBIDDEN_RE = /[\\/<>?*|":~]/g;
const INVISIBLE_RE = new RegExp(
  "[\\u0000-\\u001F\\u007F\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]",
  "g"
);
const TRIM_EDGE_RE = /^[.\-\s]+|[.\-\s]+$/g;

function cleanFilePart(value, maxLength) {
  return sanitize(String(value || ""))
    .replace(INVISIBLE_RE, "")
    .replace(CHROME_FORBIDDEN_RE, "")
    .replace(/\s+/g, " ")
    .replace(/\s+-\s+/g, " - ")
    .trim()
    .slice(0, maxLength)
    .replace(TRIM_EDGE_RE, "");
}

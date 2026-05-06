import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { capturePageWithBrowserHarness } from "./browser-harness.mjs";
import { normalizeSourceUrl } from "./url.mjs";

const BLOCKER_RE =
  /(log in|sign up|don't miss what's happening|something went wrong|rate limit|try again later)/i;

export class ExtractionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ExtractionError";
    this.details = details;
  }
}

export async function extractArticle(url, options = {}) {
  const normalizedUrl = normalizeSourceUrl(url, options);
  const capture = await capturePageWithBrowserHarness(normalizedUrl, options);
  return extractArticleFromHtml(
    capture.html,
    capture.location || normalizedUrl,
    {
      sourceUrl: normalizedUrl,
      browserTitle: capture.title,
      browserText: capture.bodyText,
    }
  );
}

export function extractArticleFromHtml(html, finalUrl, options = {}) {
  const sourceUrl = options.sourceUrl || finalUrl;
  const metadata = readMetadata(html, finalUrl, options);
  const readable = parseReadable(html, finalUrl);
  const fallback = parseFallback(html, finalUrl, metadata);
  const chosen =
    scoreArticle(readable) >= scoreArticle(fallback) ? readable : fallback;
  const content = cleanArticleHtml(
    chosen.content || fallback.content || "",
    finalUrl
  );
  const textContent = htmlToText(content);
  const title = cleanTitle(
    chosen.title || metadata.title || "Untitled X Article"
  );

  if (isLikelyBlocked(title, textContent, options.browserText)) {
    throw new ExtractionError(
      "X returned a login, rate-limit, or interstitial page. Run `npm run login`, sign in, then retry.",
      {
        title,
        finalUrl,
      }
    );
  }

  if (textContent.length < 80) {
    throw new ExtractionError(
      "Could not find enough article text on the page.",
      {
        title,
        finalUrl,
        textLength: textContent.length,
      }
    );
  }

  return {
    title,
    byline: cleanText(chosen.byline || metadata.author || ""),
    excerpt: cleanText(chosen.excerpt || metadata.description || ""),
    sourceUrl,
    finalUrl,
    content,
    textContent,
    downloadedAt: new Date().toISOString(),
  };
}

function readMetadata(html, finalUrl, options = {}) {
  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;
  const meta = (name) =>
    doc
      .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
      ?.getAttribute("content")
      ?.trim() || "";

  return {
    title: cleanTitle(
      meta("og:title") ||
        meta("twitter:title") ||
        options.browserTitle ||
        doc.title ||
        ""
    ),
    description:
      meta("og:description") ||
      meta("description") ||
      meta("twitter:description") ||
      "",
    author: meta("author") || meta("article:author") || "",
  };
}

function parseReadable(html, finalUrl) {
  try {
    const dom = new JSDOM(html, { url: finalUrl });
    const article = new Readability(dom.window.document, {
      keepClasses: false,
    }).parse();
    if (!article) {
      return {};
    }

    return {
      title: article.title,
      byline: article.byline,
      excerpt: article.excerpt,
      content: article.content,
      textContent: article.textContent,
    };
  } catch {
    return {};
  }
}

function parseFallback(html, finalUrl, metadata) {
  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;
  removeJunk(doc);

  const candidates = [
    ...doc.querySelectorAll(
      'main article, article, [role="article"], main, body'
    ),
  ];
  const best =
    candidates
      .map((node) => ({ node, score: scoreNode(node) }))
      .sort((a, b) => b.score - a.score)[0]?.node || doc.body;

  const heading = best.querySelector("h1, h2")?.textContent || "";
  return {
    title: cleanTitle(heading || metadata.title || doc.title || ""),
    byline: metadata.author || "",
    excerpt: metadata.description || "",
    content: best.innerHTML,
    textContent: best.textContent || "",
  };
}

function removeJunk(doc) {
  doc
    .querySelectorAll(
      [
        "script",
        "style",
        "noscript",
        "template",
        "svg",
        "canvas",
        "iframe",
        "form",
        "input",
        "textarea",
        "button",
        "nav",
        "header",
        "footer",
        "aside",
        '[aria-hidden="true"]',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="complementary"]',
        '[data-testid="sidebarColumn"]',
        '[data-testid="primaryColumn"] [role="progressbar"]',
      ].join(",")
    )
    .forEach((node) => node.remove());
}

function scoreNode(node) {
  const text = cleanText(node.textContent || "");
  const textScore = Math.min(text.length, 12000);
  const paragraphScore = node.querySelectorAll("p, li, blockquote").length * 90;
  const headingScore = node.querySelectorAll("h1, h2, h3").length * 140;
  const imageScore = node.querySelectorAll("img").length * 45;
  const clutterPenalty =
    node.querySelectorAll('a, time, [role="button"]').length * 8;
  return (
    textScore + paragraphScore + headingScore + imageScore - clutterPenalty
  );
}

function scoreArticle(article = {}) {
  const text = article.textContent || htmlToText(article.content || "");
  return (
    cleanText(text).length +
    (article.title ? 350 : 0) +
    (article.excerpt ? 120 : 0)
  );
}

export function sanitizeArticleHtml(content, finalUrl) {
  const dom = new JSDOM(`<main>${content}</main>`, { url: finalUrl });
  const doc = dom.window.document;
  removeJunk(doc);

  doc.querySelectorAll("a[href]").forEach((link) => {
    const href = normalizeHttpUrl(link.getAttribute("href"), finalUrl);
    if (href) {
      link.href = href;
    } else {
      link.removeAttribute("href");
    }
  });

  doc.querySelectorAll("img").forEach((img) => {
    const rawSrc =
      img.getAttribute("src") || img.getAttribute("data-src") || "";
    const src = normalizeHttpUrl(rawSrc, finalUrl);
    if (src) {
      img.src = src;
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.loading = "lazy";
    } else {
      img.remove();
    }
  });

  doc.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      if (
        /^on/i.test(attr.name) ||
        attr.name === "style" ||
        attr.name === "srcdoc"
      ) {
        node.removeAttribute(attr.name);
      }
    });
  });

  return doc.querySelector("main")?.innerHTML?.trim() || "";
}

function normalizeHttpUrl(value, finalUrl) {
  try {
    const url = new URL(String(value || ""), finalUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

function cleanArticleHtml(content, finalUrl) {
  return sanitizeArticleHtml(content, finalUrl);
}

function htmlToText(html) {
  const dom = new JSDOM(`<main>${html}</main>`);
  return cleanText(dom.window.document.body.textContent || "");
}

function cleanTitle(value) {
  return cleanText(value)
    .replace(/\s*\/\s*X\s*$/i, "")
    .replace(/\s+on X\s*$/i, "")
    .slice(0, 180);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyBlocked(title, textContent, browserText = "") {
  const compact = `${title}\n${textContent}\n${browserText}`.slice(0, 5000);
  return textContent.length < 500 && BLOCKER_RE.test(compact);
}

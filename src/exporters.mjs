import fs from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import archiver from "archiver";
import * as docx from "docx";
import { JSDOM } from "jsdom";
import { chromium } from "playwright";
import TurndownService from "turndown";
import { fileStemForArticle } from "./url.mjs";

const { Document, HeadingLevel, Packer, Paragraph, TextRun } = docx;

export function renderMarkdown(article) {
  const turndown = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  turndown.addRule("xImage", {
    filter: "img",
    replacement(_content, node) {
      const alt = node.getAttribute("alt") || "";
      const src = node.getAttribute("src") || "";
      return src ? `![${alt}](${src})` : "";
    },
  });

  const body = turndown
    .turndown(article.content || "")
    .replace(/^- {3}/gm, "- ")
    .replace(/^(\d+)\. {3}/gm, "$1. ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const meta = [
    `Source: ${article.sourceUrl}`,
    article.byline ? `Byline: ${article.byline}` : "",
    article.excerpt ? `Excerpt: ${article.excerpt}` : "",
    `Downloaded: ${article.downloadedAt}`,
  ].filter(Boolean);

  return [`# ${article.title}`, "", ...meta, "", body, ""].join("\n");
}

export function renderHtmlDocument(article) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(article.title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      color: #17201b;
      background: #ffffff;
      font: 16px/1.65 ui-serif, Georgia, "Times New Roman", serif;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 48px 42px;
    }
    h1, h2, h3 {
      color: #111713;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.18;
      letter-spacing: 0;
    }
    h1 { font-size: 34px; margin: 0 0 14px; }
    h2 { font-size: 24px; margin-top: 34px; }
    h3 { font-size: 19px; margin-top: 26px; }
    .meta {
      margin: 0 0 34px;
      color: #516057;
      font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    a { color: #005f73; overflow-wrap: anywhere; }
    img, video { max-width: 100%; height: auto; border-radius: 6px; }
    blockquote {
      margin-left: 0;
      padding-left: 18px;
      border-left: 3px solid #7a9e7e;
      color: #34443b;
    }
    pre, code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
    pre {
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      background: #f3f5f2;
      padding: 14px;
      border-radius: 6px;
    }
    @page { margin: 0.55in; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(article.title)}</h1>
    <p class="meta">
      Source: <a href="${escapeAttribute(article.sourceUrl)}">${escapeHtml(article.sourceUrl)}</a><br>
      ${article.byline ? `Byline: ${escapeHtml(article.byline)}<br>` : ""}
      Downloaded: ${escapeHtml(article.downloadedAt)}
    </p>
    ${article.content}
  </main>
</body>
</html>`;
}

export async function saveArticleFiles(
  article,
  formats,
  outputDir,
  options = {}
) {
  await mkdir(outputDir, { recursive: true });
  const stem = fileStemForArticle(article);
  const files = [];

  for (const format of formats) {
    const filePath = path.join(outputDir, `${stem}.${format}`);
    if (format === "md") {
      await writeFile(filePath, renderMarkdown(article), "utf8");
    } else if (format === "pdf") {
      await writePdf(article, filePath, options);
    } else if (format === "docx") {
      await writeDocx(article, filePath);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    const info = await stat(filePath);
    files.push({
      format,
      path: filePath,
      name: path.basename(filePath),
      bytes: info.size,
    });
  }

  return files;
}

export async function writePdf(article, filePath, options = {}) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(options.pdfTimeoutMs ?? 30000);
    await page.setContent(renderHtmlDocument(article), {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("networkidle", { timeout: 10000 })
      .catch(() => {});
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
      margin: { top: "0.2in", right: "0.2in", bottom: "0.2in", left: "0.2in" },
    });
  } finally {
    await browser.close();
  }
}

export async function writeDocx(article, filePath) {
  const children = [
    new Paragraph({ text: article.title, heading: HeadingLevel.HEADING_1 }),
    new Paragraph({
      children: [
        new TextRun({ text: "Source: ", bold: true }),
        new TextRun({ text: article.sourceUrl }),
      ],
    }),
    ...(article.byline
      ? [
          new Paragraph({
            children: [
              new TextRun({ text: "Byline: ", bold: true }),
              new TextRun(article.byline),
            ],
          }),
        ]
      : []),
    new Paragraph({ text: `Downloaded: ${article.downloadedAt}` }),
    new Paragraph({ text: "" }),
    ...htmlToDocxParagraphs(article.content),
  ];

  const document = new Document({
    creator: "X Article Downloader",
    title: article.title,
    description: article.excerpt || undefined,
    sections: [{ children }],
  });

  await writeFile(filePath, await Packer.toBuffer(document));
}

export function htmlToDocxParagraphs(html) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;
  const paragraphs = [];
  walkBlocks(body, paragraphs, { listType: null, orderedIndex: 0 });

  return paragraphs.length
    ? paragraphs
    : [new Paragraph({ text: body.textContent?.trim() || "" })];
}

function walkBlocks(node, paragraphs, listState) {
  for (const child of [...node.children]) {
    const tag = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      addTextParagraph(paragraphs, child.textContent, {
        heading: headingForTag(tag),
      });
    } else if (tag === "p") {
      addTextParagraph(paragraphs, child.textContent);
    } else if (tag === "blockquote") {
      addTextParagraph(paragraphs, child.textContent, { italics: true });
    } else if (tag === "pre") {
      addTextParagraph(paragraphs, child.textContent, { monospace: true });
    } else if (tag === "img") {
      const src = child.getAttribute("src");
      const alt = child.getAttribute("alt") || "Image";
      addTextParagraph(paragraphs, src ? `${alt}: ${src}` : alt, {
        italics: true,
      });
    } else if (tag === "ul" || tag === "ol") {
      walkBlocks(child, paragraphs, { listType: tag, orderedIndex: 0 });
    } else if (tag === "li") {
      const nextIndex = listState.orderedIndex + 1;
      const prefix = listState.listType === "ol" ? `${nextIndex}. ` : "";
      addTextParagraph(paragraphs, child.textContent, {
        bullet: listState.listType !== "ol",
        prefix,
      });
      listState.orderedIndex = nextIndex;
    } else if (hasBlockChild(child)) {
      walkBlocks(child, paragraphs, listState);
    } else {
      addTextParagraph(paragraphs, child.textContent);
    }
  }
}

function addTextParagraph(paragraphs, rawText, options = {}) {
  const text = String(rawText || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return;
  }

  const run = new TextRun({
    text: `${options.prefix || ""}${text}`,
    italics: Boolean(options.italics),
    font: options.monospace ? "Courier New" : undefined,
  });

  paragraphs.push(
    new Paragraph({
      children: [run],
      heading: options.heading,
      bullet: options.bullet ? { level: 0 } : undefined,
    })
  );
}

function headingForTag(tag) {
  if (tag === "h1") return HeadingLevel.HEADING_1;
  if (tag === "h2") return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function hasBlockChild(node) {
  return Boolean(
    node.querySelector("h1,h2,h3,h4,h5,h6,p,ul,ol,li,blockquote,pre,img")
  );
}

export async function zipFiles(files, zipPath) {
  await mkdir(path.dirname(zipPath), { recursive: true });
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    for (const file of files) {
      archive.file(file.path, { name: file.name || path.basename(file.path) });
    }
    archive.finalize();
  });

  const info = await stat(zipPath);
  return {
    path: zipPath,
    name: path.basename(zipPath),
    bytes: info.size,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

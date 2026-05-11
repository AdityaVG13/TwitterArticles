import fs from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import * as docx from "docx";
import { JSDOM } from "jsdom";
import PDFDocument from "pdfkit";
import TurndownService from "turndown";
import yazl from "yazl";
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
    const filePath = await uniqueFilePath(outputDir, stem, format);
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

async function uniqueFilePath(outputDir, stem, extension) {
  let candidate = path.join(outputDir, `${stem}.${extension}`);
  for (let index = 2; await pathExists(candidate); index += 1) {
    candidate = path.join(outputDir, `${stem} ${index}.${extension}`);
  }
  return candidate;
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export async function writePdf(article, filePath) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: {
      Title: article.title,
      Author: article.byline || "X Article Downloader",
      Subject: article.excerpt || undefined,
    },
  });

  const finished = new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    stream.on("finish", resolve);
    stream.on("error", reject);
    doc.on("error", reject);
    doc.pipe(stream);
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#111713")
    .text(article.title, { lineGap: 4 });
  doc.moveDown(0.5);

  doc.font("Helvetica").fontSize(10).fillColor("#516057");
  doc.text("Source: ", { continued: true }).fillColor("#005f73");
  doc.text(article.sourceUrl, {
    link: article.sourceUrl,
    underline: true,
    lineGap: 2,
  });
  doc.fillColor("#516057");
  if (article.byline) {
    doc.text(`Byline: ${article.byline}`, { lineGap: 2 });
  }
  doc.text(`Downloaded: ${article.downloadedAt}`);
  doc.moveDown(1.2);

  doc.fillColor("#17201b").font("Helvetica").fontSize(12);
  renderHtmlIntoPdf(doc, article.content || "");

  doc.end();
  await finished;
}

function renderHtmlIntoPdf(doc, html) {
  const dom = new JSDOM(`<body>${html}</body>`);
  walkPdfBlocks(doc, dom.window.document.body, { listType: null, index: 0 });
}

function walkPdfBlocks(doc, node, listState) {
  for (const child of [...node.children]) {
    const tag = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const size = tag === "h1" ? 18 : tag === "h2" ? 16 : 14;
      doc.moveDown(0.6);
      doc
        .font("Helvetica-Bold")
        .fontSize(size)
        .fillColor("#111713")
        .text(cleanInline(child.textContent), { lineGap: 2 });
      doc.font("Helvetica").fontSize(12).fillColor("#17201b");
      doc.moveDown(0.3);
    } else if (tag === "p") {
      const text = cleanInline(child.textContent);
      if (text) {
        doc.text(text, { lineGap: 2 });
        doc.moveDown(0.5);
      }
    } else if (tag === "blockquote") {
      const text = cleanInline(child.textContent);
      if (text) {
        doc.font("Helvetica-Oblique").fillColor("#34443b");
        doc.text(text, { indent: 18, lineGap: 2 });
        doc.font("Helvetica").fillColor("#17201b");
        doc.moveDown(0.5);
      }
    } else if (tag === "pre") {
      const text = child.textContent || "";
      if (text.trim()) {
        doc.font("Courier").fontSize(10).fillColor("#34443b");
        doc.text(text, { lineGap: 1.5 });
        doc.font("Helvetica").fontSize(12).fillColor("#17201b");
        doc.moveDown(0.5);
      }
    } else if (tag === "ul" || tag === "ol") {
      walkPdfBlocks(doc, child, { listType: tag, index: 0 });
      doc.moveDown(0.3);
    } else if (tag === "li") {
      const text = cleanInline(child.textContent);
      if (text) {
        const marker =
          listState.listType === "ol" ? `${++listState.index}. ` : "• ";
        doc.text(`${marker}${text}`, { indent: 14, lineGap: 2 });
      }
    } else if (tag === "img") {
      const src = child.getAttribute("src");
      const alt = child.getAttribute("alt") || "Image";
      if (src) {
        doc.font("Helvetica-Oblique").fontSize(10).fillColor("#516057");
        doc.text(`${alt}: ${src}`, {
          link: src,
          underline: true,
          lineGap: 1.5,
        });
        doc.font("Helvetica").fontSize(12).fillColor("#17201b");
        doc.moveDown(0.4);
      }
    } else if (hasPdfBlockChild(child)) {
      walkPdfBlocks(doc, child, listState);
    } else {
      const text = cleanInline(child.textContent);
      if (text) {
        doc.text(text, { lineGap: 2 });
        doc.moveDown(0.4);
      }
    }
  }
}

function hasPdfBlockChild(node) {
  return Boolean(
    node.querySelector("h1,h2,h3,h4,h5,h6,p,ul,ol,li,blockquote,pre,img")
  );
}

function cleanInline(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
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
    const archive = new yazl.ZipFile();
    output.on("close", resolve);
    output.on("error", reject);
    archive.outputStream.on("error", reject);
    archive.outputStream.pipe(output);
    for (const file of files) {
      archive.addFile(file.path, file.name || path.basename(file.path), {
        compress: true,
      });
    }
    archive.end();
  });

  const info = await stat(zipPath);
  return {
    path: zipPath,
    name: path.basename(zipPath),
    bytes: info.size,
  };
}


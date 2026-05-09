import express from "express";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAccessControlMiddleware,
  defaultAllowedOrigins,
  parseAllowedOrigins,
} from "./access-control.mjs";
import { formatBatchZipName, uniqueZipName } from "./batch-zip.mjs";
import { normalizeCapturedArticle } from "./capture.mjs";
import { downloadFilePath } from "./download-paths.mjs";
import { extractArticle } from "./extractor.mjs";
import { saveArticleFiles, zipFiles } from "./exporters.mjs";
import { normalizePort } from "./loopback-origin.mjs";
import { EXTENSION_ID } from "./native-host-config.mjs";
import { createSecurityHeadersMiddleware } from "./security-headers.mjs";
import { normalizeSourceUrl, parseFormats, parseUrlInput } from "./url.mjs";
import { shouldCreateZip } from "./zip-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const downloadRoot = path.resolve(
  process.env.XAD_OUTPUT_DIR || path.join(rootDir, "downloads")
);
const port = normalizePort(process.env.PORT || process.env.XAD_PORT || 4512);
const managed = process.env.XAD_MANAGED === "1";
const idleMs = Number(process.env.XAD_SERVER_IDLE_MS || (managed ? 120000 : 0));

const app = express();
let server = null;
let activeRequests = 0;
let idleTimer = null;

if (idleMs > 0) {
  app.use((req, res, next) => {
    activeRequests += 1;
    clearTimeout(idleTimer);
    let finished = false;
    const finish = () => {
      if (finished) {
        return;
      }

      finished = true;
      activeRequests -= 1;
      scheduleIdleShutdown();
    };
    res.once("finish", finish);
    res.once("close", finish);
    next();
  });
}

const allowedOrigins = process.env.XAD_ALLOWED_ORIGINS
  ? parseAllowedOrigins(process.env.XAD_ALLOWED_ORIGINS)
  : defaultAllowedOrigins({ port, extensionId: EXTENSION_ID });
app.use(createSecurityHeadersMiddleware());
app.use(createAccessControlMiddleware({ allowedOrigins }));
app.use(express.json({ limit: "25mb" }));
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "x-article-downloader",
    managed,
    idleMs,
    pid: process.pid,
  });
});

app.post("/api/download", async (req, res) => {
  const startedAt = Date.now();
  let urls;
  let formats;

  try {
    urls = parseUrlInput(req.body.urls).map((url) => normalizeSourceUrl(url));
    formats = parseFormats(req.body.formats);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
    return;
  }

  if (!urls.length) {
    res
      .status(400)
      .json({ ok: false, error: "Paste at least one X Article URL." });
    return;
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(downloadRoot, runId);
  await mkdir(runDir, { recursive: true });

  const successes = [];
  const failures = [];
  for (const url of urls) {
    try {
      const article = await extractArticle(url);
      const files = await saveArticleFiles(article, formats, runDir);
      successes.push({
        url,
        title: article.title,
        files: files.map((file) => toDownloadResponse(runId, file)),
      });
    } catch (error) {
      failures.push({
        url,
        error: error.message,
      });
    }
  }

  const allFiles = successes.flatMap((item) => item.files);
  let zip = null;
  if (shouldCreateZip(allFiles, req.body.zip)) {
    const zipped = await zipFiles(
      allFiles.map((file) => ({
        path: path.join(runDir, file.name),
        name: file.name,
      })),
      path.join(runDir, `x-articles-${runId}.zip`)
    );
    zip = toDownloadResponse(runId, zipped);
  }

  res.status(successes.length ? 200 : 502).json({
    ok: Boolean(successes.length),
    elapsedMs: Date.now() - startedAt,
    successes,
    failures,
    zip,
  });
});

app.post("/api/save-capture", async (req, res) => {
  const startedAt = Date.now();
  let article;
  let formats;

  try {
    article = normalizeCapturedArticle(req.body.article);
    formats = parseFormats(req.body.formats);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
    return;
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(downloadRoot, runId);
  await mkdir(runDir, { recursive: true });

  try {
    const files = await saveArticleFiles(article, formats, runDir);
    let zip = null;
    if (shouldCreateZip(files, req.body.zip)) {
      zip = toDownloadResponse(
        runId,
        await zipFiles(files, path.join(runDir, `x-article-${runId}.zip`))
      );
    }

    res.json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      success: {
        url: article.sourceUrl,
        title: article.title,
        files: files.map((file) => toDownloadResponse(runId, file)),
      },
      zip,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post("/api/save-batch", async (req, res) => {
  const startedAt = Date.now();
  const rawArticles = Array.isArray(req.body.articles) ? req.body.articles : [];
  if (!rawArticles.length) {
    res
      .status(400)
      .json({ ok: false, error: "Batch requires at least one article." });
    return;
  }

  let formats;
  try {
    formats = parseFormats(req.body.formats);
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
    return;
  }

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const runDir = path.join(downloadRoot, runId);
  await mkdir(runDir, { recursive: true });

  const successes = [];
  const failures = [];
  const filesForZip = [];
  const zipEntryNames = [];

  for (const raw of rawArticles) {
    let article;
    try {
      article = normalizeCapturedArticle(raw);
    } catch (error) {
      failures.push({
        url: raw?.sourceUrl || raw?.finalUrl || "",
        error: error.message,
      });
      continue;
    }

    try {
      const files = await saveArticleFiles(article, formats, runDir);
      successes.push({
        url: article.sourceUrl,
        title: article.title,
        files: files.map((file) => toDownloadResponse(runId, file)),
      });
      for (const file of files) {
        const entryName = uniqueZipName(file.name, zipEntryNames);
        zipEntryNames.push(entryName);
        filesForZip.push({ path: file.path, name: entryName });
      }
    } catch (error) {
      failures.push({
        url: article.sourceUrl,
        error: error.message,
      });
    }
  }

  if (!successes.length) {
    res.status(502).json({
      ok: false,
      elapsedMs: Date.now() - startedAt,
      successes,
      failures,
    });
    return;
  }

  const zipName = formatBatchZipName(new Date());
  const zipped = await zipFiles(filesForZip, path.join(runDir, zipName));
  const zip = toDownloadResponse(runId, zipped);

  res.json({
    ok: true,
    elapsedMs: Date.now() - startedAt,
    successes,
    failures,
    zip,
  });
});

app.get("/downloads/:runId/:fileName", (req, res) => {
  let requested;
  try {
    requested = downloadFilePath(
      downloadRoot,
      req.params.runId,
      req.params.fileName
    );
  } catch {
    res.status(403).send("Forbidden");
    return;
  }

  res.download(requested);
});

server = app.listen(port, "127.0.0.1", () => {
  console.log(`X Article Downloader listening on http://127.0.0.1:${port}`);
  console.log(`Downloads: ${downloadRoot}`);
  scheduleIdleShutdown();
});

process.on("SIGTERM", () => {
  server?.close(() => process.exit(0));
});

function toDownloadResponse(runId, file) {
  return {
    name: file.name,
    bytes: file.bytes,
    url: `/downloads/${encodeURIComponent(runId)}/${encodeURIComponent(file.name)}`,
  };
}

function scheduleIdleShutdown() {
  if (idleMs <= 0 || activeRequests > 0 || !server) {
    return;
  }

  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    server.close(() => process.exit(0));
  }, idleMs);
}

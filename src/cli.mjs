#!/usr/bin/env node
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createBrowserContext, extractArticleWithContext } from './extractor.mjs';
import { saveArticleFiles, zipFiles } from './exporters.mjs';
import { normalizeSourceUrl, parseFormats, parseUrlInput } from './url.mjs';

const args = process.argv.slice(2);
const options = {
  formats: ['md'],
  outputDir: path.resolve(process.cwd(), 'downloads', new Date().toISOString().replace(/[:.]/g, '-')),
  zip: false,
  headful: false,
  urls: []
};

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--format' || arg === '--formats') {
    options.formats = parseFormats(args[++index]);
  } else if (arg === '--out' || arg === '--output') {
    options.outputDir = path.resolve(args[++index]);
  } else if (arg === '--zip') {
    options.zip = true;
  } else if (arg === '--headful') {
    options.headful = true;
  } else if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  } else {
    options.urls.push(arg);
  }
}

const urls = parseUrlInput(options.urls).map((url) => normalizeSourceUrl(url));
if (!urls.length) {
  printHelp();
  process.exit(1);
}

await mkdir(options.outputDir, { recursive: true });
const context = await createBrowserContext({ headless: !options.headful });
const files = [];
const failures = [];

try {
  for (const url of urls) {
    try {
      const article = await extractArticleWithContext(context, url);
      const saved = await saveArticleFiles(article, options.formats, options.outputDir);
      files.push(...saved);
      console.log(`OK ${article.title}`);
    } catch (error) {
      failures.push({ url, error: error.message });
      console.error(`FAIL ${url}: ${error.message}`);
    }
  }
} finally {
  await context.close();
}

if (options.zip && files.length) {
  const zip = await zipFiles(files, path.join(options.outputDir, 'x-articles.zip'));
  console.log(zip.path);
} else {
  for (const file of files) {
    console.log(file.path);
  }
}

process.exit(failures.length ? 2 : 0);

function printHelp() {
  console.log(`Usage:
  node src/cli.mjs --formats md,pdf,docx --zip URL [URL...]

Options:
  --formats md,pdf,docx  Output formats. Default: md
  --out DIR              Output directory. Default: ./downloads/<timestamp>
  --zip                  Also create x-articles.zip
  --headful              Show browser while extracting
  npm run login          Open X login once before private/auth-gated downloads`);
}

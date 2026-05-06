#!/usr/bin/env node
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXTENSION_ID,
  NATIVE_HOST_NAME,
  chromeNativeHostDir,
  nativeHostManifest
} from './native-host-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const hostPath = path.join(rootDir, 'native-host', 'host.mjs');
const supportDir = path.join(os.homedir(), 'Library', 'Application Support', 'XArticleDownloaderNativeHost');
const wrapperPath = path.join(supportDir, 'run-host.sh');
const wrapperLogPath = path.join(os.homedir(), 'Library', 'Logs', 'x-article-downloader-native-host.log');
const browser = parseBrowserArg(process.argv.slice(2));
const manifestDir = chromeNativeHostDir(browser);
const manifestPath = path.join(manifestDir, `${NATIVE_HOST_NAME}.json`);
const manifest = nativeHostManifest(wrapperPath, EXTENSION_ID);

await mkdir(manifestDir, { recursive: true });
await mkdir(supportDir, { recursive: true });
await mkdir(path.dirname(wrapperLogPath), { recursive: true });
await chmod(hostPath, 0o755);
await writeFile(wrapperPath, [
  '#!/bin/sh',
  `echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] wrapper pid=$$ started" >> ${shellQuote(wrapperLogPath)}`,
  `exec ${shellQuote(process.execPath)} ${shellQuote(hostPath)} 2>> ${shellQuote(wrapperLogPath)}`,
  ''
].join('\n'), 'utf8');
await chmod(wrapperPath, 0o755);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Installed native host: ${manifestPath}`);
console.log(`Extension ID: ${EXTENSION_ID}`);
console.log(`Load unpacked extension directory: ${path.join(rootDir, 'extension')}`);

function parseBrowserArg(args) {
  const browserIndex = args.findIndex((arg) => arg === '--browser');
  if (browserIndex === -1) {
    return 'chrome';
  }

  return args[browserIndex + 1] || 'chrome';
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

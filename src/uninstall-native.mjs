#!/usr/bin/env node
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  NATIVE_HOST_NAME,
  chromeNativeHostDir,
} from "./native-host-config.mjs";

const browser = parseBrowserArg(process.argv.slice(2));
const manifestPath = path.join(
  chromeNativeHostDir(browser),
  `${NATIVE_HOST_NAME}.json`
);
const supportDir = path.join(
  os.homedir(),
  "Library",
  "Application Support",
  "XArticleDownloaderNativeHost"
);

await rm(manifestPath, { force: true });
await rm(supportDir, { recursive: true, force: true });
console.log(`Removed native host manifest: ${manifestPath}`);

function parseBrowserArg(args) {
  const browserIndex = args.findIndex((arg) => arg === "--browser");
  if (browserIndex === -1) {
    return "chrome";
  }

  return args[browserIndex + 1] || "chrome";
}

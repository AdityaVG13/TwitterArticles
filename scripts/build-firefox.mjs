#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIREFOX_EXTENSION_ID } from "../src/native-host-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, "extension");
const outputDir = path.join(rootDir, "extension-firefox");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(sourceDir, outputDir, { recursive: true });

const manifestPath = path.join(outputDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

delete manifest.key;
manifest.background = {
  scripts: ["background.js"],
  type: "module",
};
manifest.browser_specific_settings = {
  gecko: {
    id: FIREFOX_EXTENSION_ID,
    strict_min_version: "115.0",
  },
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Built Firefox extension: ${outputDir}`);
console.log(`Firefox extension id: ${FIREFOX_EXTENSION_ID}`);

#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const targets = [
  ["src", ".mjs"],
  ["native-host", ".mjs"],
  ["scripts", ".mjs"],
  ["extension", ".js"],
  ["extension/content", ".js"],
  ["test", ".mjs"],
];

const files = [];
for (const [dir, ext] of targets) {
  const absDir = path.join(rootDir, dir);
  const entries = await readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(path.join(absDir, entry.name));
    }
  }
}

const child = spawn(process.execPath, ["--check", ...files], {
  stdio: "inherit",
});
child.on("close", (code) => process.exit(code ?? 1));

#!/usr/bin/env node
import { spawn } from "node:child_process";
import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXTENSION_ID,
  FIREFOX_EXTENSION_ID,
  nativeHostInstallPaths,
  nativeHostManifest,
} from "./native-host-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const hostPath = path.join(rootDir, "native-host", "host.mjs");
const browser = parseBrowserArg(process.argv.slice(2));
const paths = nativeHostInstallPaths({ browser });
const extensionId =
  paths.family === "firefox" ? FIREFOX_EXTENSION_ID : EXTENSION_ID;
const manifest = nativeHostManifest(paths.wrapperPath, extensionId, browser);

if (paths.family === "firefox") {
  await runNode([path.join(rootDir, "scripts", "build-firefox.mjs")]);
}

await mkdir(paths.manifestDir, { recursive: true });
await mkdir(paths.supportDir, { recursive: true });
await mkdir(path.dirname(paths.logPath), { recursive: true });
if (paths.platform !== "win32") {
  await chmod(hostPath, 0o755);
}

await writeFile(
  paths.wrapperPath,
  wrapperScript(paths.platform, {
    hostPath,
    logPath: paths.logPath,
    nodePath: process.execPath,
  }),
  "utf8"
);
if (paths.platform !== "win32") {
  await chmod(paths.wrapperPath, 0o755);
}

await writeFile(
  paths.manifestPath,
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);
if (paths.platform === "win32") {
  await run("reg", [
    "add",
    paths.registryKey,
    "/ve",
    "/t",
    "REG_SZ",
    "/d",
    paths.manifestPath,
    "/f",
  ]);
}

console.log(`Installed native host manifest: ${paths.manifestPath}`);
if (paths.registryKey) {
  console.log(`Registered Windows key: ${paths.registryKey}`);
}
console.log(`Extension ID: ${extensionId}`);
const extensionDir =
  paths.family === "firefox"
    ? path.join(rootDir, "extension-firefox")
    : path.join(rootDir, "extension");
if (paths.family === "firefox") {
  console.log(`Load temporary add-on manifest: ${extensionDir}`);
  console.log(
    "Open about:debugging#/runtime/this-firefox, click Load Temporary Add-on, select manifest.json."
  );
} else {
  console.log(`Load unpacked extension directory: ${extensionDir}`);
}

function parseBrowserArg(args) {
  const browserIndex = args.findIndex((arg) => arg === "--browser");
  if (browserIndex === -1) {
    return "chrome";
  }
  return args[browserIndex + 1] || "chrome";
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function windowsQuote(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function wrapperScript(platform, { nodePath, hostPath, logPath }) {
  if (platform === "win32") {
    return [
      "@echo off",
      "setlocal",
      `>> ${windowsQuote(logPath)} echo [%DATE% %TIME%] wrapper started`,
      `${windowsQuote(nodePath)} ${windowsQuote(hostPath)} 2>> ${windowsQuote(logPath)}`,
      "",
    ].join("\r\n");
  }

  return [
    "#!/bin/sh",
    `echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] wrapper pid=$$ started" >> ${shellQuote(logPath)}`,
    `exec ${shellQuote(nodePath)} ${shellQuote(hostPath)} 2>> ${shellQuote(logPath)}`,
    "",
  ].join("\n");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `${command} exited with ${code}`));
      }
    });
  });
}

function runNode(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Firefox build exited with ${code}`));
      }
    });
  });
}

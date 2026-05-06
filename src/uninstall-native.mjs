#!/usr/bin/env node
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { nativeHostInstallPaths } from "./native-host-config.mjs";

const browser = parseBrowserArg(process.argv.slice(2));
const paths = nativeHostInstallPaths({ browser });

if (paths.platform === "win32") {
  await run("reg", ["delete", paths.registryKey, "/f"]).catch((error) => {
    if (!/unable to find|cannot find|not found/i.test(error.message)) {
      throw error;
    }
  });
}
await rm(paths.manifestPath, { force: true });
await rm(paths.supportDir, { recursive: true, force: true });

console.log(`Removed native host manifest: ${paths.manifestPath}`);
if (paths.registryKey) {
  console.log(`Removed Windows key: ${paths.registryKey}`);
}

function parseBrowserArg(args) {
  const browserIndex = args.findIndex((arg) => arg === "--browser");
  if (browserIndex === -1) {
    return "chrome";
  }
  return args[browserIndex + 1] || "chrome";
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

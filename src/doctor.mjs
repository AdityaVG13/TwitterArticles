#!/usr/bin/env node
import { access, constants, mkdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { browserHarnessCommand } from "./browser-harness.mjs";
import { normalizePort } from "./loopback-origin.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const checks = [];

await addCheck("Node.js is version 20 or newer", checkNodeVersion);
await addCheck("Dependencies are installed", checkDependencies);
await addCheck("Output directory is writable", checkOutputDirectory);
await addCheck("Configured local port is usable", checkPort);
await addCheck("Browser Harness is available", checkBrowserHarness);
await addCheck(
  "Native Messaging installer can run on this OS",
  checkNativeHostOs
);

for (const check of checks) {
  console.log(`${check.ok ? "OK" : "FAIL"} ${check.label}`);
  if (check.detail) {
    console.log(`   ${check.detail}`);
  }
}

const failures = checks.filter((check) => !check.ok);
if (failures.length) {
  console.log("");
  console.log("Fix the failed checks above, then run `npm run doctor` again.");
  process.exit(1);
}

console.log("");
console.log("Ready. Run `npm start`, then open http://127.0.0.1:4512.");

async function addCheck(label, fn) {
  try {
    checks.push({ label, ...(await fn()) });
  } catch (error) {
    checks.push({ label, ok: false, detail: error.message });
  }
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    ok: major >= 20,
    detail: `Current Node.js: ${process.version}`,
  };
}

async function checkDependencies() {
  try {
    await import("express");
    await import("jsdom");
    return { ok: true };
  } catch {
    return {
      ok: false,
      detail: "Run `npm install` from the repo root.",
    };
  }
}

async function checkOutputDirectory() {
  const outputDir = path.resolve(
    process.env.XAD_OUTPUT_DIR || path.join(rootDir, "downloads")
  );
  const probe = path.join(outputDir, `.doctor-${process.pid}`);
  await mkdir(outputDir, { recursive: true });
  await writeFile(probe, "ok", "utf8");
  await rm(probe);
  await access(outputDir, constants.W_OK);
  return { ok: true, detail: displayPath(outputDir) };
}

async function checkPort() {
  const port = normalizePort(process.env.PORT || process.env.XAD_PORT || 4512);
  const available = await isPortAvailable(port);
  return {
    ok: available,
    detail: available
      ? `127.0.0.1:${port}`
      : `127.0.0.1:${port} is already in use. Stop the existing process or set XAD_PORT.`,
  };
}

async function checkBrowserHarness() {
  const command = browserHarnessCommand();
  const result = await run(command, ["--help"], 8000);
  if (result.ok) {
    return { ok: true, detail: command };
  }

  return {
    ok: false,
    detail:
      `Command failed: ${command}. Install Browser Harness or set XAD_BROWSER_HARNESS_COMMAND. ` +
      result.detail,
  };
}

function checkNativeHostOs() {
  if (os.platform() === "darwin") {
    return { ok: true, detail: "macOS detected" };
  }

  return {
    ok: false,
    detail: "The included Native Messaging installer supports macOS.",
  };
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function run(command, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let finished = false;
    const timeout = setTimeout(() => finish(false, "Timed out."), timeoutMs);

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => finish(false, error.message));
    child.on("close", (code) => finish(code === 0, stderr.trim()));

    function finish(ok, detail = "") {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeout);
      if (!ok) {
        child.kill("SIGTERM");
      }
      resolve({ ok, detail });
    }
  });
}

function displayPath(target) {
  const relative = path.relative(rootDir, target);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return `./${relative}`;
  }

  return target;
}

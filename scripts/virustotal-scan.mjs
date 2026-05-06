#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const API_ROOT = "https://www.virustotal.com/api/v3";
const apiKey = process.env.VIRUSTOTAL_API_KEY || process.env.VT_API_KEY;
const args = process.argv.slice(2);
const upload = args.includes("--upload");
const fileArg = args.find((arg) => !arg.startsWith("--"));

if (!apiKey) {
  console.error("Set VIRUSTOTAL_API_KEY or VT_API_KEY before using this.");
  process.exit(1);
}

const cleanupPaths = [];
try {
  await main();
} finally {
  await Promise.all(
    cleanupPaths.map((target) => rm(target, { recursive: true }))
  );
}

async function main() {
  const filePath = fileArg ? path.resolve(fileArg) : await packArtifact();
  const buffer = await readFile(filePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  console.log(`file=${path.basename(filePath)}`);
  console.log(`sha256=${sha256}`);

  const existing = await vtRequest(`/files/${sha256}`, { allow404: true });
  if (existing) {
    summarizeFileReport(existing, sha256);
    process.exitCode = reportExitCode(
      existing.data?.attributes?.last_analysis_stats
    );
    return;
  }

  if (!upload) {
    console.log("VirusTotal has no report for this hash.");
    console.log("Run with --upload to submit the artifact for analysis.");
    process.exitCode = 2;
    return;
  }

  const form = new FormData();
  form.set("file", new Blob([buffer]), path.basename(filePath));
  const uploadResponse = await vtRequest("/files", {
    method: "POST",
    body: form,
  });
  const analysisId = uploadResponse.data?.id;
  if (!analysisId) {
    throw new Error(
      "VirusTotal upload response did not include an analysis id."
    );
  }

  console.log(`analysis=${analysisId}`);
  const analysis = await waitForAnalysis(analysisId);
  summarizeAnalysis(analysis, sha256);
  process.exitCode = reportExitCode(analysis.data?.attributes?.stats);
}

async function packArtifact() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "xad-vt-"));
  cleanupPaths.push(tmpDir);
  const output = await run("npm", [
    "pack",
    "--json",
    "--pack-destination",
    tmpDir,
  ]);
  const data = JSON.parse(output);
  return path.join(tmpDir, data[0].filename);
}

async function vtRequest(pathname, options = {}) {
  const response = await fetch(`${API_ROOT}${pathname}`, {
    method: options.method || "GET",
    headers: {
      "x-apikey": apiKey,
      ...(options.headers || {}),
    },
    body: options.body,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};

  if (response.status === 404 && options.allow404) {
    return null;
  }

  if (!response.ok) {
    const message = json.error?.message || text || response.statusText;
    throw new Error(`VirusTotal ${response.status}: ${message}`);
  }

  return json;
}

async function waitForAnalysis(analysisId) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const analysis = await vtRequest(`/analyses/${analysisId}`);
    if (analysis.data?.attributes?.status === "completed") {
      return analysis;
    }

    await sleep(5000);
  }

  throw new Error("VirusTotal analysis did not finish within 120 seconds.");
}

function summarizeFileReport(report, sha256) {
  const stats = report.data?.attributes?.last_analysis_stats || {};
  printStats(stats);
  console.log(`url=https://www.virustotal.com/gui/file/${sha256}`);
}

function summarizeAnalysis(analysis, sha256) {
  const stats = analysis.data?.attributes?.stats || {};
  printStats(stats);
  console.log(`url=https://www.virustotal.com/gui/file/${sha256}`);
}

function printStats(stats) {
  console.log(
    [
      `malicious=${stats.malicious || 0}`,
      `suspicious=${stats.suspicious || 0}`,
      `harmless=${stats.harmless || 0}`,
      `undetected=${stats.undetected || 0}`,
      `timeout=${stats.timeout || 0}`,
    ].join(" ")
  );
}

function reportExitCode(stats = {}) {
  return stats.malicious || stats.suspicious ? 2 : 0;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr.trim() || `${command} exited with ${code}`));
      }
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

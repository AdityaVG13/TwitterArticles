import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const serverPath = path.join(rootDir, "src", "server.mjs");

function captured(overrides = {}) {
  const baseTitle = overrides.title || "Sample Batch Article";
  const baseBody =
    overrides.content ||
    `
      <h2>Body</h2>
      <p>This batch article fixture has more than the eighty character minimum required so it survives validation.</p>
      <p>It also includes a second paragraph to be safe and contains enough text content to pass validation by length.</p>
    `;
  return {
    title: baseTitle,
    byline: overrides.byline || "Fixture Author",
    excerpt: "Fixture excerpt",
    sourceUrl: overrides.sourceUrl || "https://x.com/example_user/status/100",
    finalUrl: overrides.sourceUrl || "https://x.com/example_user/status/100",
    content: baseBody,
    textContent:
      "Body This batch article fixture has more than the eighty character minimum required so it survives validation. It also includes a second paragraph to be safe and contains enough text content to pass validation by length.",
    downloadedAt: "2026-05-09T00:00:00.000Z",
    ...overrides,
  };
}

test("save-batch endpoint zips multiple captured articles", async () => {
  const port = await getFreePort();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "xad-batch-"));
  const server = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      XAD_PORT: String(port),
      XAD_OUTPUT_DIR: outputDir,
      XAD_SERVER_IDLE_MS: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(port);
    const response = await postJson(port, "/api/save-batch", {
      formats: ["md"],
      articles: [
        captured({
          title: "Alpha Article",
          sourceUrl: "https://x.com/example_user/status/1",
        }),
        captured({
          title: "Beta Article",
          sourceUrl: "https://x.com/example_user/status/2",
        }),
      ],
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.successes.length, 2);
    assert.equal(response.body.failures.length, 0);
    assert.match(
      response.body.zip.name,
      /^Twitter Download - \d{4}-\d{2}-\d{2}\.zip$/
    );
    assert(response.body.zip.bytes > 100);
  } finally {
    server.kill("SIGTERM");
    await Promise.race([
      once(server, "exit"),
      sleep(2500).then(() => server.kill("SIGKILL")),
    ]);
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("save-batch endpoint rejects an empty article list", async () => {
  const port = await getFreePort();
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "xad-batch-"));
  const server = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      XAD_PORT: String(port),
      XAD_OUTPUT_DIR: outputDir,
      XAD_SERVER_IDLE_MS: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(port);
    const response = await postJson(port, "/api/save-batch", {
      formats: ["md"],
      articles: [],
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.body.ok, false);
  } finally {
    server.kill("SIGTERM");
    await Promise.race([
      once(server, "exit"),
      sleep(2500).then(() => server.kill("SIGKILL")),
    ]);
    await rm(outputDir, { recursive: true, force: true });
  }
});

function postJson(port, urlPath, body) {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: urlPath,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(payload.length),
        },
        timeout: 8000,
      },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
        });
        res.on("end", () => {
          try {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: JSON.parse(buf),
            });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForHealth(port) {
  const deadline = Date.now() + 5000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await getJson(port, "/health");
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }
  throw lastError || new Error("server did not start");
}

function getJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(
      { hostname: "127.0.0.1", port, path: urlPath, timeout: 1500 },
      (res) => {
        let buf = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          buf += chunk;
        });
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(buf) });
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

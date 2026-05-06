import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const serverPath = path.join(rootDir, "src", "server.mjs");

test("server health is local-safe and security-headered", async () => {
  const port = await getFreePort();
  const server = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      XAD_PORT: String(port),
      XAD_SERVER_IDLE_MS: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForHealth(port);
    const response = await httpJson(`http://127.0.0.1:${port}/health`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.downloadRoot, undefined);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.match(
      response.headers["content-security-policy"],
      /default-src 'self'/
    );
  } finally {
    server.kill("SIGTERM");
    await Promise.race([
      once(server, "exit"),
      sleep(2500).then(() => server.kill("SIGKILL")),
    ]);
  }
});

function httpJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 1200 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body),
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

async function waitForHealth(port) {
  const deadline = Date.now() + 5000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await httpJson(`http://127.0.0.1:${port}/health`);
    } catch (error) {
      lastError = error;
      await sleep(100);
    }
  }

  throw lastError || new Error("server did not start");
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

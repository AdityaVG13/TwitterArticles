import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { once } from "node:events";
import { createAccessControlMiddleware } from "../src/access-control.mjs";

test("access control allows same-origin loopback requests", async () => {
  const server = await startServer(
    createAccessControlMiddleware({
      allowedOrigins: ["http://127.0.0.1:4512"],
    })
  );
  try {
    const response = await request(server, {
      method: "POST",
      origin: "http://127.0.0.1:4512",
    });
    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "http://127.0.0.1:4512"
    );
  } finally {
    server.close();
  }
});

test("access control allows native extension requests", async () => {
  const server = await startServer(
    createAccessControlMiddleware({
      allowedOrigins: ["chrome-extension://example-extension-id"],
    })
  );
  try {
    const response = await request(server, {
      method: "OPTIONS",
      origin: "chrome-extension://example-extension-id",
    });
    assert.equal(response.statusCode, 204);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "chrome-extension://example-extension-id"
    );
  } finally {
    server.close();
  }
});

test("access control rejects unknown browser origins", async () => {
  const server = await startServer(
    createAccessControlMiddleware({
      allowedOrigins: ["http://127.0.0.1:4512"],
    })
  );
  try {
    const response = await request(server, {
      method: "POST",
      origin: "https://evil.example",
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.body, "Forbidden origin");
  } finally {
    server.close();
  }
});

test("access control allows non-browser requests without origin", async () => {
  const server = await startServer(
    createAccessControlMiddleware({
      allowedOrigins: ["http://127.0.0.1:4512"],
    })
  );
  try {
    const response = await request(server, { method: "GET" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  } finally {
    server.close();
  }
});

function startServer(middleware) {
  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 200;
      res.end("ok");
    });
  });
  server.listen(0, "127.0.0.1");
  return once(server, "listening").then(() => server);
}

function request(server, options) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: "/",
        method: options.method,
        headers: options.origin ? { origin: options.origin } : undefined,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

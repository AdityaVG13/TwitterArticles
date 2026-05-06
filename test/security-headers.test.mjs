import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { createSecurityHeadersMiddleware } from "../src/security-headers.mjs";

test("security headers lock down local browser responses", async () => {
  const server = await startServer(createSecurityHeadersMiddleware());
  try {
    const response = await request(server);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.equal(response.headers["referrer-policy"], "no-referrer");
    assert.equal(response.headers["x-frame-options"], "DENY");
    assert.equal(
      response.headers["permissions-policy"],
      "camera=(), microphone=(), geolocation=()"
    );
    assert.match(
      response.headers["content-security-policy"],
      /default-src 'self'/
    );
    assert.match(
      response.headers["content-security-policy"],
      /frame-ancestors 'none'/
    );
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

function request(server) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: address.port,
        path: "/",
        method: "GET",
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve({ statusCode: res.statusCode, headers: res.headers });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

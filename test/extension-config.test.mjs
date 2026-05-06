import assert from "node:assert/strict";
import test from "node:test";
import { normalizeServerOrigin } from "../extension/config.js";

test("normalizeServerOrigin stores a clean loopback origin", () => {
  assert.equal(
    normalizeServerOrigin("http://127.0.0.1:4512/path?x=1#hash"),
    "http://127.0.0.1:4512"
  );
  assert.equal(
    normalizeServerOrigin("http://localhost:5512/"),
    "http://localhost:5512"
  );
});

test("normalizeServerOrigin rejects non-local browser targets", () => {
  assert.throws(() => normalizeServerOrigin("https://127.0.0.1:4512"), /HTTP/);
  assert.throws(
    () => normalizeServerOrigin("http://example.com:4512"),
    /loopback/
  );
  assert.throws(() => normalizeServerOrigin("http://127.0.0.1"), /port/);
});

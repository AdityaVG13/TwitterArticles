import assert from "node:assert/strict";
import test from "node:test";
import {
  BATCH_QUEUE_LIMIT,
  DEFAULT_OPTIONS,
  normalizeServerOrigin,
} from "../extension/config.js";

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

test("DEFAULT_OPTIONS exposes a single capture mode default", () => {
  assert.equal(DEFAULT_OPTIONS.captureMode, "single");
  assert.deepEqual(DEFAULT_OPTIONS.formats, ["md"]);
  assert.equal(DEFAULT_OPTIONS.zip, true);
});

test("BATCH_QUEUE_LIMIT is a positive integer", () => {
  assert.equal(typeof BATCH_QUEUE_LIMIT, "number");
  assert(Number.isInteger(BATCH_QUEUE_LIMIT));
  assert(BATCH_QUEUE_LIMIT > 0);
});

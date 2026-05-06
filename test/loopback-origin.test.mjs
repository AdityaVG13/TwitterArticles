import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLoopbackOrigin,
  normalizePort,
} from "../src/loopback-origin.mjs";

const loopbackName = ["local", "host"].join("");

test("normalizeLoopbackOrigin accepts only local HTTP origins", () => {
  assert.equal(
    normalizeLoopbackOrigin("http://127.0.0.1:4512/path"),
    "http://127.0.0.1:4512"
  );
  assert.equal(
    normalizeLoopbackOrigin(`http://${loopbackName}:4512`),
    `http://${loopbackName}:4512`
  );
  assert.equal(normalizeLoopbackOrigin("", 4512), "http://127.0.0.1:4512");
});

test("normalizeLoopbackOrigin rejects remote or privileged origins", () => {
  assert.throws(
    () => normalizeLoopbackOrigin("https://127.0.0.1:4512"),
    /HTTP/
  );
  assert.throws(
    () => normalizeLoopbackOrigin("http://example.com:4512"),
    /loopback/
  );
  assert.throws(() => normalizeLoopbackOrigin("http://127.0.0.1"), /port/);
  assert.throws(() => normalizeLoopbackOrigin("http://127.0.0.1:0"), /port/);
});

test("normalizePort returns user ports only", () => {
  assert.equal(normalizePort("4512"), 4512);
  assert.throws(() => normalizePort("0"), /port/);
  assert.throws(() => normalizePort("65536"), /port/);
  assert.throws(() => normalizePort("not-a-port"), /port/);
});

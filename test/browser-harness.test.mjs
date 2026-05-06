import assert from "node:assert/strict";
import test from "node:test";
import {
  browserHarnessCommand,
  parseBrowserHarnessResult,
} from "../src/browser-harness.mjs";

test("parseBrowserHarnessResult ignores harness chatter", () => {
  assert.deepEqual(
    parseBrowserHarnessResult(
      [
        "[browser-harness] update available",
        '__XAD_BROWSER_HARNESS_RESULT__ {"ok":true,"title":"Article"}',
      ].join("\n")
    ),
    { ok: true, title: "Article" }
  );
});

test("browserHarnessCommand defaults to browser-harness", () => {
  const previous = process.env.XAD_BROWSER_HARNESS_COMMAND;
  delete process.env.XAD_BROWSER_HARNESS_COMMAND;
  try {
    assert.equal(browserHarnessCommand(), "browser-harness");
  } finally {
    if (previous === undefined) {
      delete process.env.XAD_BROWSER_HARNESS_COMMAND;
    } else {
      process.env.XAD_BROWSER_HARNESS_COMMAND = previous;
    }
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  fileStemForArticle,
  normalizeSourceUrl,
  parseFormats,
  parseUrlInput,
} from "../src/url.mjs";

test("parseUrlInput accepts pasted batches", () => {
  assert.deepEqual(
    parseUrlInput(
      "https://x.com/a/status/1,\n<https://twitter.com/b/status/2>"
    ),
    ["https://x.com/a/status/1", "https://twitter.com/b/status/2"]
  );
});

test("normalizeSourceUrl canonicalizes twitter.com to x.com", () => {
  assert.equal(
    normalizeSourceUrl("https://twitter.com/a/status/1#ignored"),
    "https://x.com/a/status/1"
  );
});

test("normalizeSourceUrl rejects non-X hosts by default", () => {
  assert.throws(
    () => normalizeSourceUrl("https://example.com/article"),
    /Only x.com/
  );
});

test("parseFormats validates export formats", () => {
  assert.deepEqual(parseFormats("md,pdf,docx,pdf"), ["md", "pdf", "docx"]);
  assert.throws(() => parseFormats("html"), /Unsupported format/);
});

test("fileStemForArticle uses article title and author", () => {
  const stem = fileStemForArticle({
    title: "A/B: Useful Article?",
    byline: "Example Author",
    sourceUrl: "https://x.com/a/status/1",
  });
  assert.equal(stem, "AB Useful Article - Example Author");
});

test("fileStemForArticle falls back to X username when byline is missing", () => {
  const stem = fileStemForArticle({
    title: "Useful Article",
    sourceUrl: "https://x.com/example_user/status/1",
  });
  assert.equal(stem, "Useful Article - @example_user");
});

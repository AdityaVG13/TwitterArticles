import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { downloadFilePath } from "../src/download-paths.mjs";

test("downloadFilePath resolves files under the download root", () => {
  const root = path.join(os.tmpdir(), "xad-download-root");
  assert.equal(
    downloadFilePath(root, "2026-05-06T12-00-00-000Z", "Article - Author.md"),
    path.join(root, "2026-05-06T12-00-00-000Z", "Article - Author.md")
  );
});

test("downloadFilePath rejects path traversal and nested segments", () => {
  const root = path.join(os.tmpdir(), "xad-download-root");
  assert.throws(() => downloadFilePath(root, "..", "Article.md"), /Invalid/);
  assert.throws(
    () => downloadFilePath(root, "run", "../Article.md"),
    /Invalid/
  );
  assert.throws(
    () => downloadFilePath(root, "run/child", "Article.md"),
    /Invalid/
  );
  assert.throws(
    () => downloadFilePath(root, "run", "folder\\Article.md"),
    /Invalid/
  );
});

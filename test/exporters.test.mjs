import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  renderMarkdown,
  saveArticleFiles,
  zipFiles,
} from "../src/exporters.mjs";

const article = {
  title: "Useful X Article",
  byline: "Example Author",
  excerpt: "Fixture excerpt",
  sourceUrl: "https://x.com/example_user/status/123",
  finalUrl: "https://x.com/example_user/status/123",
  downloadedAt: "2026-05-05T00:00:00.000Z",
  content: `
    <h2>Section</h2>
    <p>Article body with <a href="https://example.com">a link</a>.</p>
    <ul><li>First point</li><li>Second point</li></ul>
    <img src="https://example.com/image.png" alt="Chart">
  `,
  textContent: "Section Article body with a link. First point Second point",
};

test("renderMarkdown preserves useful structure", () => {
  const markdown = renderMarkdown(article);
  assert.match(markdown, /^# Useful X Article/);
  assert.match(markdown, /Source: https:\/\/x.com\/example_user\/status\/123/);
  assert.match(markdown, /## Section/);
  assert.match(markdown, /- First point/);
  assert.match(markdown, /!\[Chart\]\(https:\/\/example.com\/image.png\)/);
});

test("saveArticleFiles writes md and docx", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xad-"));
  try {
    const files = await saveArticleFiles(article, ["md", "docx"], dir);
    assert.equal(files.length, 2);
    assert.deepEqual(
      files.map((file) => file.name),
      [
        "Useful X Article - Example Author.md",
        "Useful X Article - Example Author.docx",
      ]
    );
    assert(files.some((file) => file.name.endsWith(".md")));
    assert(files.some((file) => file.name.endsWith(".docx")));

    const markdownFile = files.find((file) => file.name.endsWith(".md"));
    const markdown = await readFile(markdownFile.path, "utf8");
    assert.match(markdown, /Useful X Article/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("saveArticleFiles avoids overwriting duplicate article names", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xad-"));
  try {
    const first = await saveArticleFiles(article, ["md"], dir);
    const second = await saveArticleFiles(article, ["md"], dir);
    assert.equal(first[0].name, "Useful X Article - Example Author.md");
    assert.equal(second[0].name, "Useful X Article - Example Author 2.md");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("zipFiles bundles generated files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xad-"));
  try {
    const files = await saveArticleFiles(article, ["md"], dir);
    const zip = await zipFiles(files, path.join(dir, "bundle.zip"));
    assert.equal(zip.name, "bundle.zip");
    assert(zip.bytes > 100);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("saveArticleFiles writes pdf via pure-JS renderer", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xad-"));
  try {
    const files = await saveArticleFiles(article, ["pdf"], dir);
    assert.equal(files.length, 1);
    assert.equal(
      files[0].name,
      "Useful X Article - Example Author.pdf"
    );
    assert(files[0].bytes > 1000);
    const head = await readFile(files[0].path);
    assert.equal(head.subarray(0, 4).toString(), "%PDF");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCapturedArticle } from "../src/capture.mjs";

test("normalizeCapturedArticle sanitizes and validates extension payloads", () => {
  const article = normalizeCapturedArticle({
    title: "Captured Article / X",
    sourceUrl: "https://x.com/example_user/status/123",
    finalUrl: "https://x.com/example_user/status/123",
    content: `
      <article>
        <h1>Captured Article</h1>
        <p onclick="alert(1)">This captured article has enough body text to pass validation.</p>
        <p>Another paragraph keeps the fixture realistic and useful for exporter tests.</p>
        <script>alert(1)</script>
      </article>
    `,
  });

  assert.equal(article.title, "Captured Article / X");
  assert.match(article.content, /Captured Article/);
  assert.doesNotMatch(article.content, /script|onclick/);
});

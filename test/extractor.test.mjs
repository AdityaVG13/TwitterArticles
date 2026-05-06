import assert from "node:assert/strict";
import test from "node:test";
import {
  extractArticleFromHtml,
  sanitizeArticleHtml,
} from "../src/extractor.mjs";

test("extractArticleFromHtml reads article metadata and content", () => {
  const article = extractArticleFromHtml(
    `
    <!doctype html>
    <html>
      <head>
        <title>Ignored / X</title>
        <meta property="og:title" content="The Useful Article / X">
        <meta name="description" content="Short excerpt">
      </head>
      <body>
        <nav>noise</nav>
        <main>
          <article>
            <h1>The Useful Article</h1>
            <p>This is a long enough paragraph for extraction to accept it. It has real article body text.</p>
            <p>This second paragraph makes the fixture more realistic and easier to score.</p>
          </article>
        </main>
      </body>
    </html>
  `,
    "https://x.com/example_user/status/123"
  );

  assert.equal(article.title, "The Useful Article");
  assert.equal(article.sourceUrl, "https://x.com/example_user/status/123");
  assert.match(article.content, /long enough paragraph/);
  assert.match(article.textContent, /second paragraph/);
});

test("extractArticleFromHtml reports login walls", () => {
  assert.throws(
    () =>
      extractArticleFromHtml(
        `
    <html><head><title>X</title></head><body><main>Log in Sign up Don't miss what's happening</main></body></html>
  `,
        "https://x.com/example_user/status/123"
      ),
    /login/
  );
});

test("sanitizeArticleHtml removes active content and unsafe URLs", () => {
  const html = sanitizeArticleHtml(
    `
      <p style="position:absolute" onclick="alert(1)">
        Safe text
        <a href="javascript:alert(1)">bad link</a>
        <a href="/relative">good link</a>
        <img src="data:text/html,<script>alert(1)</script>" alt="bad image">
        <img src="/image.jpg" alt="good image">
      </p>
    `,
    "https://x.com/example_user/status/123"
  );

  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /data:text\/html/i);
  assert.doesNotMatch(html, /onclick/i);
  assert.doesNotMatch(html, /style=/i);
  assert.match(html, /href="https:\/\/x.com\/relative"/);
  assert.match(html, /src="https:\/\/x.com\/image\.jpg"/);
});

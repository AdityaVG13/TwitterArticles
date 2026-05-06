import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import test from "node:test";

test("extension content script captures an article-like page", async () => {
  const dom = new JSDOM(
    `
    <!doctype html>
    <html>
      <head>
        <meta property="og:title" content="Extension Article / X">
        <meta name="description" content="Extension fixture">
      </head>
      <body>
        <nav>noise</nav>
        <main>
          <article>
            <h1>Extension Article</h1>
            <p>This extension capture test includes enough text to pass the minimum article threshold.</p>
            <p>It also includes a second paragraph and an <a href="/relative">internal link</a>.</p>
          </article>
        </main>
      </body>
    </html>
  `,
    {
      url: "https://x.com/example_user/status/123",
      runScripts: "dangerously",
    }
  );

  const script = await readFile(
    new URL("../extension/content/extract-page.js", import.meta.url),
    "utf8"
  );
  dom.window.eval(script);
  const result = dom.window.__xadExtractPage();

  assert.equal(result.ok, true);
  assert.equal(result.article.title, "Extension Article");
  assert.match(result.article.content, /internal link/);
  assert.match(result.article.content, /https:\/\/x.com\/relative/);
});

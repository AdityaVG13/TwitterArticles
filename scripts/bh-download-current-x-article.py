"""
Browser Harness helper for the current X Article tab.

Usage:
  npm start
  bh-user https://x.com/user/status/123
  bh <<'PY'
  exec(open("scripts/bh-download-current-x-article.py").read())
  print(download_current_x_article(formats=["md", "pdf", "docx"]))
  PY
"""

import json
import os
import urllib.request


XAD_SERVER = os.environ.get("XAD_SERVER") or "http://127.0.0.1:" + os.environ.get(
    "XAD_PORT",
    "4512",
)


def download_current_x_article(formats=None, zip_result=True, server_origin=XAD_SERVER):
    formats = formats or ["md"]
    capture = js(_extractor_js())
    if not capture or not capture.get("ok"):
        raise RuntimeError((capture or {}).get("error") or "Could not capture current page")

    payload = json.dumps({
        "article": capture["article"],
        "formats": formats,
        "zip": zip_result,
    }).encode("utf-8")

    req = urllib.request.Request(
        server_origin.rstrip("/") + "/api/save-capture",
        data=payload,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        result = json.loads(response.read().decode("utf-8"))

    if not result.get("ok"):
        raise RuntimeError(result.get("error") or "Local exporter failed")

    if result.get("zip"):
        result["zip"]["absoluteUrl"] = server_origin.rstrip("/") + result["zip"]["url"]
    for file in result["success"]["files"]:
        file["absoluteUrl"] = server_origin.rstrip("/") + file["url"]
    return result


def _extractor_js():
    return r"""
(() => {
  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
  function metaContent(name) {
    return document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() || '';
  }
  function removeJunk(root) {
    root.querySelectorAll([
      'script','style','noscript','template','svg','canvas','iframe','form','input','textarea','button',
      'nav','header','footer','aside','[aria-hidden="true"]','[role="navigation"]','[role="banner"]',
      '[role="complementary"]','[data-testid="sidebarColumn"]','[role="progressbar"]'
    ].join(',')).forEach((node) => node.remove());
  }
  function scoreNode(node) {
    const textLength = cleanText(node.textContent || '').length;
    return Math.min(textLength, 12000)
      + node.querySelectorAll('p, li, blockquote').length * 90
      + node.querySelectorAll('h1, h2, h3').length * 140
      + node.querySelectorAll('img').length * 45
      - node.querySelectorAll('a, time, [role="button"]').length * 8;
  }
  function normalize(root) {
    root.querySelectorAll('a[href]').forEach((link) => {
      try { link.href = new URL(link.getAttribute('href'), location.href).toString(); }
      catch { link.removeAttribute('href'); }
    });
    root.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      try {
        img.src = new URL(src, location.href).toString();
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
      } catch { img.remove(); }
    });
  }
  try {
    const clone = document.documentElement.cloneNode(true);
    removeJunk(clone);
    const candidates = [...clone.querySelectorAll('main article, article, [role="article"], main, body')];
    const best = candidates.map((node) => ({ node, score: scoreNode(node) })).sort((a, b) => b.score - a.score)[0]?.node || clone.querySelector('body') || clone;
    normalize(best);
    const title = cleanText(metaContent('og:title') || metaContent('twitter:title') || best.querySelector('h1,h2')?.textContent || document.title || 'Untitled X Article')
      .replace(/\s*\/\s*X\s*$/i, '')
      .replace(/\s+on X\s*$/i, '')
      .slice(0, 180);
    const textContent = cleanText(best.textContent || '');
    if (textContent.length < 80) throw new Error('Not enough article text found in the current tab.');
    return {
      ok: true,
      article: {
        title,
        byline: cleanText(metaContent('author') || metaContent('article:author') || ''),
        excerpt: cleanText(metaContent('og:description') || metaContent('description') || ''),
        sourceUrl: location.href,
        finalUrl: location.href,
        content: best.innerHTML.trim(),
        textContent,
        downloadedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
})()
"""

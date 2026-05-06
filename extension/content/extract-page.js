globalThis.__xadExtractPage = function __xadExtractPage() {
  try {
    const clone = document.documentElement.cloneNode(true);
    removeJunk(clone);
    const best = selectBestNode(clone);
    normalizeLinksAndImages(best);

    const title = cleanTitle(
      metaContent('og:title') ||
      metaContent('twitter:title') ||
      best.querySelector('h1,h2')?.textContent ||
      document.title ||
      'Untitled X Article'
    );
    const byline = cleanText(metaContent('author') || metaContent('article:author') || '');
    const excerpt = cleanText(metaContent('og:description') || metaContent('description') || '');
    const content = best.innerHTML.trim();
    const textContent = cleanText(best.textContent || '');

    if (textContent.length < 80) {
      throw new Error('Not enough article text found in the current tab.');
    }

    return {
      ok: true,
      article: {
        title,
        byline,
        excerpt,
        sourceUrl: location.href,
        finalUrl: location.href,
        content,
        textContent,
        downloadedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }

  function metaContent(name) {
    return document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content?.trim() || '';
  }

  function removeJunk(root) {
    root.querySelectorAll([
      'script',
      'style',
      'noscript',
      'template',
      'svg',
      'canvas',
      'iframe',
      'form',
      'input',
      'textarea',
      'button',
      'nav',
      'header',
      'footer',
      'aside',
      '[aria-hidden="true"]',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="complementary"]',
      '[data-testid="sidebarColumn"]',
      '[role="progressbar"]'
    ].join(',')).forEach((node) => node.remove());
  }

  function selectBestNode(root) {
    const candidates = [
      ...root.querySelectorAll('main article, article, [role="article"], main, body')
    ];

    return candidates
      .map((node) => ({ node, score: scoreNode(node) }))
      .sort((a, b) => b.score - a.score)[0]?.node || root.querySelector('body') || root;
  }

  function scoreNode(node) {
    const textLength = cleanText(node.textContent || '').length;
    const paragraphScore = node.querySelectorAll('p, li, blockquote').length * 90;
    const headingScore = node.querySelectorAll('h1, h2, h3').length * 140;
    const imageScore = node.querySelectorAll('img').length * 45;
    const clutterPenalty = node.querySelectorAll('a, time, [role="button"]').length * 8;
    return Math.min(textLength, 12000) + paragraphScore + headingScore + imageScore - clutterPenalty;
  }

  function normalizeLinksAndImages(root) {
    root.querySelectorAll('a[href]').forEach((link) => {
      try {
        link.href = new URL(link.getAttribute('href'), location.href).toString();
      } catch {
        link.removeAttribute('href');
      }
    });

    root.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      try {
        img.src = new URL(src, location.href).toString();
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
      } catch {
        img.remove();
      }
    });

    root.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attr) => {
        if (/^on/i.test(attr.name)) {
          node.removeAttribute(attr.name);
        }
      });
    });
  }

  function cleanTitle(value) {
    return cleanText(value)
      .replace(/\s*\/\s*X\s*$/i, '')
      .replace(/\s+on X\s*$/i, '')
      .slice(0, 180);
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }
};

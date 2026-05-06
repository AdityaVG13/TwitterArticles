import { JSDOM } from 'jsdom';
import { sanitizeArticleHtml } from './extractor.mjs';
import { normalizeSourceUrl } from './url.mjs';

export function normalizeCapturedArticle(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Missing captured article payload.');
  }

  const sourceUrl = normalizeSourceUrl(raw.sourceUrl || raw.finalUrl || locationFallback(raw));
  const finalUrl = normalizeSourceUrl(raw.finalUrl || sourceUrl);
  const title = cleanText(raw.title || 'Untitled X Article').slice(0, 180);
  const content = sanitizeArticleHtml(raw.content || '', finalUrl);
  const textContent = cleanText(new JSDOM(`<main>${content}</main>`).window.document.body.textContent || raw.textContent || '');

  if (!title) {
    throw new Error('Captured article is missing a title.');
  }

  if (textContent.length < 80) {
    throw new Error('Captured article does not contain enough text.');
  }

  return {
    title,
    byline: cleanText(raw.byline || ''),
    excerpt: cleanText(raw.excerpt || ''),
    sourceUrl,
    finalUrl,
    content,
    textContent,
    downloadedAt: new Date().toISOString()
  };
}

function locationFallback(raw) {
  return raw.url || raw.href || '';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

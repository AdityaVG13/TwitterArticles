import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldCreateZip } from '../src/zip-policy.mjs';

test('shouldCreateZip only zips multiple files when requested', () => {
  assert.equal(shouldCreateZip([], true), false);
  assert.equal(shouldCreateZip([{ name: 'article.md' }], true), false);
  assert.equal(shouldCreateZip([{ name: 'article.md' }, { name: 'article.pdf' }], true), true);
  assert.equal(shouldCreateZip([{ name: 'article.md' }, { name: 'article.pdf' }], false), false);
});

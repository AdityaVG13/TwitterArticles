import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  EXTENSION_ID,
  EXTENSION_KEY,
  NATIVE_HOST_NAME,
  chromeExtensionIdFromKey,
  nativeHostManifest
} from '../src/native-host-config.mjs';

test('stable extension key produces expected Chrome extension id', () => {
  assert.equal(chromeExtensionIdFromKey(EXTENSION_KEY), 'hphgjlnkhoocfnhpdabnhjddfdknkmkd');
  assert.equal(EXTENSION_ID, 'hphgjlnkhoocfnhpdabnhjddfdknkmkd');
});

test('native host manifest includes extension origin', () => {
  const manifest = nativeHostManifest(path.resolve('/tmp/host.mjs'), EXTENSION_ID);
  assert.equal(manifest.name, NATIVE_HOST_NAME);
  assert.equal(manifest.type, 'stdio');
  assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${EXTENSION_ID}/`]);
});

import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

export const NATIVE_HOST_NAME = 'org.x_article_downloader.native_host';
export const EXTENSION_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzq84nI7Rg0TnCa+d+SK/Ls/3fUGrirWO/+kmgErGUtQtL5BQEPeK/z4MxQjWt53+sS4OVFf2ohj+89ul9v9mmZHw4HVXK28Mr85Lsu+lriSoIDCpVL2Cymmh6BrObcorbYO+PJMwTUJ8agMfka5bmdqyo1DMPHYg/RAlWTMDSHYZ5nR8lQ1m/8l/Zsb+7czLaVgf4yEIjAV6dFqoI3/adkQsRj6HpvsewH4UpiS/Ho8tYRBNe4OQqKqn9F9s/GzpKORk7cokGkgJHm7lIbln++b3Y8h8A6llUCcwiUW1LksM0LCkr8C2vPnMBCen6oFh4hEm8k67XEyAGWDHLpEjRQIDAQAB';
export const EXTENSION_ID = chromeExtensionIdFromKey(EXTENSION_KEY);

export function chromeExtensionIdFromKey(key) {
  const der = Buffer.from(key, 'base64');
  const hash = crypto.createHash('sha256').update(der).digest().subarray(0, 16);
  return [...hash]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .replace(/[0-9a-f]/g, (char) => String.fromCharCode(97 + Number.parseInt(char, 16)));
}

export function nativeHostManifest(hostPath, extensionId = EXTENSION_ID) {
  return {
    name: NATIVE_HOST_NAME,
    description: 'Starts and stops the X Article Downloader local server.',
    path: hostPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`]
  };
}

export function chromeNativeHostDir(browser = 'chrome') {
  const home = os.homedir();
  const dirs = {
    chrome: ['Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'],
    canary: ['Library', 'Application Support', 'Google', 'Chrome Canary', 'NativeMessagingHosts'],
    chromium: ['Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'],
    brave: ['Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'],
    edge: ['Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts']
  };

  const parts = dirs[browser];
  if (!parts) {
    throw new Error(`Unsupported browser: ${browser}`);
  }

  return path.join(home, ...parts);
}

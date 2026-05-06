import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";

export const NATIVE_HOST_NAME = "org.x_article_downloader.native_host";
export const EXTENSION_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzq84nI7Rg0TnCa+d+SK/Ls/3fUGrirWO/+kmgErGUtQtL5BQEPeK/z4MxQjWt53+sS4OVFf2ohj+89ul9v9mmZHw4HVXK28Mr85Lsu+lriSoIDCpVL2Cymmh6BrObcorbYO+PJMwTUJ8agMfka5bmdqyo1DMPHYg/RAlWTMDSHYZ5nR8lQ1m/8l/Zsb+7czLaVgf4yEIjAV6dFqoI3/adkQsRj6HpvsewH4UpiS/Ho8tYRBNe4OQqKqn9F9s/GzpKORk7cokGkgJHm7lIbln++b3Y8h8A6llUCcwiUW1LksM0LCkr8C2vPnMBCen6oFh4hEm8k67XEyAGWDHLpEjRQIDAQAB";
export const EXTENSION_ID = chromeExtensionIdFromKey(EXTENSION_KEY);

export function chromeExtensionIdFromKey(key) {
  const der = Buffer.from(key, "base64");
  const hash = crypto.createHash("sha256").update(der).digest().subarray(0, 16);
  return [...hash]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .replace(/[0-9a-f]/g, (char) =>
      String.fromCharCode(97 + Number.parseInt(char, 16))
    );
}

export function nativeHostManifest(hostPath, extensionId = EXTENSION_ID) {
  return {
    name: NATIVE_HOST_NAME,
    description: "Starts and stops the X Article Downloader local server.",
    path: hostPath,
    type: "stdio",
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };
}

export function nativeHostInstallPaths(options = {}) {
  const platform = options.platform || process.platform;
  const browser = options.browser || "chrome";
  const pathApi = pathForPlatform(platform);
  const supportDir = nativeHostSupportDir(options);
  const manifestDir =
    platform === "win32" ? supportDir : chromeNativeHostDir(browser, options);
  const wrapperName = platform === "win32" ? "run-host.cmd" : "run-host.sh";

  return {
    platform,
    browser,
    manifestDir,
    supportDir,
    manifestPath: pathApi.join(manifestDir, `${NATIVE_HOST_NAME}.json`),
    wrapperPath: pathApi.join(supportDir, wrapperName),
    logPath: nativeHostLogPath(options),
    registryKey:
      platform === "win32" ? windowsNativeHostRegistryKey(browser) : "",
  };
}

export function nativeHostSupportDir(options = {}) {
  const platform = options.platform || process.platform;
  const home = options.home || os.homedir();
  const pathApi = pathForPlatform(platform);

  if (platform === "darwin") {
    return pathApi.join(
      home,
      "Library",
      "Application Support",
      "XArticleDownloaderNativeHost"
    );
  }

  if (platform === "linux") {
    return pathApi.join(
      home,
      ".local",
      "share",
      "x-article-downloader",
      "native-host"
    );
  }

  if (platform === "win32") {
    return pathApi.join(
      options.localAppData ||
        process.env.LOCALAPPDATA ||
        pathApi.join(home, "AppData", "Local"),
      "XArticleDownloaderNativeHost"
    );
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

export function nativeHostLogPath(options = {}) {
  const platform = options.platform || process.platform;
  const home = options.home || os.homedir();
  const pathApi = pathForPlatform(platform);

  if (platform === "darwin") {
    return pathApi.join(
      home,
      "Library",
      "Logs",
      "x-article-downloader-native-host.log"
    );
  }

  if (platform === "linux") {
    return pathApi.join(
      home,
      ".local",
      "state",
      "x-article-downloader",
      "native-host.log"
    );
  }

  if (platform === "win32") {
    return pathApi.join(nativeHostSupportDir(options), "native-host.log");
  }

  throw new Error(`Unsupported platform: ${platform}`);
}

export function chromeNativeHostDir(browser = "chrome", options = {}) {
  const platform = options.platform || process.platform;
  const home = options.home || os.homedir();
  const pathApi = pathForPlatform(platform);
  const macDirs = {
    chrome: [
      "Library",
      "Application Support",
      "Google",
      "Chrome",
      "NativeMessagingHosts",
    ],
    canary: [
      "Library",
      "Application Support",
      "Google",
      "Chrome Canary",
      "NativeMessagingHosts",
    ],
    chromium: [
      "Library",
      "Application Support",
      "Chromium",
      "NativeMessagingHosts",
    ],
    brave: [
      "Library",
      "Application Support",
      "BraveSoftware",
      "Brave-Browser",
      "NativeMessagingHosts",
    ],
    edge: [
      "Library",
      "Application Support",
      "Microsoft Edge",
      "NativeMessagingHosts",
    ],
  };

  const linuxDirs = {
    chrome: [".config", "google-chrome", "NativeMessagingHosts"],
    "chrome-for-testing": [
      ".config",
      "google-chrome-for-testing",
      "NativeMessagingHosts",
    ],
    chromium: [".config", "chromium", "NativeMessagingHosts"],
  };

  if (platform === "win32") {
    windowsNativeHostRegistryKey(browser);
    return nativeHostSupportDir({ ...options, platform });
  }

  if (platform !== "darwin" && platform !== "linux") {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const dirs = platform === "linux" ? linuxDirs : macDirs;
  const parts = dirs[browser];
  if (!parts) {
    throw new Error(`Unsupported browser for ${platform}: ${browser}`);
  }

  return pathApi.join(home, ...parts);
}

export function windowsNativeHostRegistryKey(browser = "chrome") {
  if (browser !== "chrome") {
    throw new Error(`Unsupported browser for win32: ${browser}`);
  }

  return `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
}

function pathForPlatform(platform) {
  return platform === "win32" ? path.win32 : path.posix;
}

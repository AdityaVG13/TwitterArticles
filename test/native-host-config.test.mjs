import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  EXTENSION_ID,
  EXTENSION_KEY,
  NATIVE_HOST_NAME,
  chromeExtensionIdFromKey,
  chromeNativeHostDir,
  nativeHostInstallPaths,
  nativeHostManifest,
  windowsNativeHostRegistryKey,
} from "../src/native-host-config.mjs";

test("stable extension key produces expected Chrome extension id", () => {
  assert.equal(
    chromeExtensionIdFromKey(EXTENSION_KEY),
    "hphgjlnkhoocfnhpdabnhjddfdknkmkd"
  );
  assert.equal(EXTENSION_ID, "hphgjlnkhoocfnhpdabnhjddfdknkmkd");
});

test("native host manifest includes extension origin", () => {
  const manifest = nativeHostManifest(
    path.resolve("/tmp/host.mjs"),
    EXTENSION_ID
  );
  assert.equal(manifest.name, NATIVE_HOST_NAME);
  assert.equal(manifest.type, "stdio");
  assert.deepEqual(manifest.allowed_origins, [
    `chrome-extension://${EXTENSION_ID}/`,
  ]);
});

test("native host installer paths support Chrome on Linux", () => {
  const paths = nativeHostInstallPaths({
    browser: "chrome",
    platform: "linux",
    home: "/home/example",
  });

  assert.equal(
    paths.manifestPath,
    "/home/example/.config/google-chrome/NativeMessagingHosts/org.x_article_downloader.native_host.json"
  );
  assert.equal(
    paths.wrapperPath,
    "/home/example/.local/share/x-article-downloader/native-host/run-host.sh"
  );
  assert.equal(
    paths.logPath,
    "/home/example/.local/state/x-article-downloader/native-host.log"
  );
});

test("native host installer paths support Chrome on Windows", () => {
  const paths = nativeHostInstallPaths({
    browser: "chrome",
    platform: "win32",
    home: "C:\\Home",
    localAppData: "C:\\LocalAppData",
  });

  assert.equal(
    paths.manifestPath,
    "C:\\LocalAppData\\XArticleDownloaderNativeHost\\org.x_article_downloader.native_host.json"
  );
  assert.equal(
    paths.wrapperPath,
    "C:\\LocalAppData\\XArticleDownloaderNativeHost\\run-host.cmd"
  );
  assert.equal(
    paths.registryKey,
    "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\org.x_article_downloader.native_host"
  );
});

test("browser path helpers reject unsupported browser and platform combinations", () => {
  assert.equal(
    chromeNativeHostDir("chrome", {
      platform: "linux",
      home: "/home/example",
    }),
    "/home/example/.config/google-chrome/NativeMessagingHosts"
  );
  assert.throws(
    () =>
      chromeNativeHostDir("brave", {
        platform: "linux",
        home: "/home/example",
      }),
    /Unsupported browser/
  );
  assert.throws(
    () => windowsNativeHostRegistryKey("edge"),
    /Unsupported browser/
  );
  assert.throws(
    () =>
      chromeNativeHostDir("edge", {
        platform: "win32",
        home: "C:\\Home",
        localAppData: "C:\\LocalAppData",
      }),
    /Unsupported browser/
  );
});

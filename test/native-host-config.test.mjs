import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  EXTENSION_ID,
  EXTENSION_KEY,
  FIREFOX_EXTENSION_ID,
  NATIVE_HOST_NAME,
  browserFamily,
  chromeExtensionIdFromKey,
  chromeNativeHostDir,
  firefoxNativeHostDir,
  nativeHostInstallPaths,
  nativeHostManifest,
  windowsFirefoxNativeHostRegistryKey,
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
    "C:\\LocalAppData\\XArticleDownloaderNativeHost\\chromium\\org.x_article_downloader.native_host.json"
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

test("firefox native host manifest uses allowed_extensions", () => {
  const manifest = nativeHostManifest(
    path.resolve("/tmp/host.mjs"),
    FIREFOX_EXTENSION_ID,
    "firefox"
  );
  assert.equal(manifest.name, NATIVE_HOST_NAME);
  assert.equal(manifest.type, "stdio");
  assert.deepEqual(manifest.allowed_extensions, [FIREFOX_EXTENSION_ID]);
  assert.equal(manifest.allowed_origins, undefined);
});

test("firefox installer paths target Mozilla locations on Linux", () => {
  const paths = nativeHostInstallPaths({
    browser: "firefox",
    platform: "linux",
    home: "/home/example",
  });
  assert.equal(paths.family, "firefox");
  assert.equal(
    paths.manifestPath,
    "/home/example/.mozilla/native-messaging-hosts/org.x_article_downloader.native_host.json"
  );
  assert.equal(
    firefoxNativeHostDir({ platform: "linux", home: "/home/example" }),
    "/home/example/.mozilla/native-messaging-hosts"
  );
});

test("firefox installer paths target Mozilla registry on Windows", () => {
  const paths = nativeHostInstallPaths({
    browser: "firefox",
    platform: "win32",
    home: "C:\\Home",
    localAppData: "C:\\LocalAppData",
  });
  assert.equal(paths.family, "firefox");
  assert.equal(
    paths.manifestPath,
    "C:\\LocalAppData\\XArticleDownloaderNativeHost\\firefox\\org.x_article_downloader.native_host.json"
  );
  assert.equal(
    paths.registryKey,
    "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\org.x_article_downloader.native_host"
  );
  assert.equal(
    windowsFirefoxNativeHostRegistryKey(),
    "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\org.x_article_downloader.native_host"
  );
});

test("firefox installer paths target Mozilla on macOS", () => {
  const paths = nativeHostInstallPaths({
    browser: "firefox",
    platform: "darwin",
    home: "/home/example",
  });
  assert.equal(
    paths.manifestPath,
    "/home/example/Library/Application Support/Mozilla/NativeMessagingHosts/org.x_article_downloader.native_host.json"
  );
});

test("browserFamily classifies known browsers", () => {
  assert.equal(browserFamily("chrome"), "chromium");
  assert.equal(browserFamily("brave"), "chromium");
  assert.equal(browserFamily("edge"), "chromium");
  assert.equal(browserFamily("firefox"), "firefox");
  assert.throws(() => browserFamily("safari"), /Unsupported browser/);
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

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const thisFile = fileURLToPath(import.meta.url);
const personalName = String.fromCharCode(97, 100, 105, 116, 121, 97);
const loopbackName = ["local", "host"].join("");
const fixedLocalOrigin = `http://${loopbackName}:4512`;
const oldBrowserRuntime = ["play", "wright"].join("");
const homeDirPrefix = ["Users"].join("");
const oldBrowserHarnessFolder = ["Developer", "browser-harness"].join("/");
const intentionalDonationLink = "ko-fi.com/adityavg13";
const forbidden = [
  {
    label: "personal macOS home path",
    pattern: new RegExp(`/${["Users", personalName].join("/")}`, "i"),
  },
  {
    label: "absolute macOS user path",
    pattern: new RegExp(`/${homeDirPrefix}/[^\\s'")]+`, "i"),
  },
  {
    label: "local Browser Harness checkout folder",
    pattern: new RegExp(escapeRegExp(oldBrowserHarnessFolder), "i"),
  },
  {
    label: "home-relative local support path",
    pattern: /~\/Library\/Application Support/i,
  },
  {
    label: "personal GitHub username",
    pattern: new RegExp(["Aditya", "VG13"].join(""), "i"),
  },
  {
    label: "personal GitHub display name",
    pattern: new RegExp([personalName, "g"].join(""), "i"),
  },
  {
    label: "personal GitHub noreply id",
    pattern: new RegExp(["44177453", personalName].join(".*"), "i"),
  },
  {
    label: "Mac hardware note",
    pattern: /MacBook|M5 Max/i,
  },
  {
    label: "personal native host id",
    pattern: new RegExp(["com", personalName].join("\\."), "i"),
  },
  {
    label: "personal X fixture URL",
    pattern: new RegExp(["x\\.com", personalName].join("/"), "i"),
  },
  {
    label: "old local repo path slug",
    pattern: new RegExp(["twitter", "article", "downloader"].join("-"), "i"),
  },
  {
    label: "personal GitHub repo name",
    pattern: /TwitterArticles/i,
  },
  {
    label: "fixed localhost port",
    pattern: new RegExp(escapeRegExp(fixedLocalOrigin), "i"),
  },
  {
    label: "old browser runtime",
    pattern: new RegExp(oldBrowserRuntime, "i"),
  },
];

test("public release files do not contain personal development references", async () => {
  const files = await listScannedFiles();
  const failures = [];
  for (const file of files) {
    if (file === thisFile) {
      continue;
    }
    const content = removeIntentionalPublicLinks(await readFile(file, "utf8"));
    for (const item of forbidden) {
      if (item.pattern.test(content)) {
        failures.push(`${path.relative(rootDir, file)}: ${item.label}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("package is publishable metadata, not private app metadata", async () => {
  const pkg = JSON.parse(
    await readFile(path.join(rootDir, "package.json"), "utf8")
  );
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.author, undefined);
  assert.equal(pkg.license, "MIT");
  assert.equal(pkg.engines.node, ">=20");
});

test("extension local host permissions are configurable by port", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(rootDir, "extension", "manifest.json"), "utf8")
  );
  assert.ok(manifest.host_permissions.includes("http://127.0.0.1/*"));
  assert.ok(manifest.host_permissions.includes("http://localhost/*"));
  assert.ok(!manifest.host_permissions.includes("http://127.0.0.1:4512/*"));
  assert.ok(!manifest.host_permissions.includes(`${fixedLocalOrigin}/*`));
});

test("public UI avoids dynamic HTML injection sinks", async () => {
  const appJs = await readFile(path.join(rootDir, "public", "app.js"), "utf8");
  assert.doesNotMatch(appJs, /\.innerHTML\s*=/);
});

async function listScannedFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "-z"], {
    cwd: rootDir,
    encoding: "buffer",
    maxBuffer: 1024 * 1024,
  });
  return stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((file) => path.join(rootDir, file));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeIntentionalPublicLinks(content) {
  return content.replaceAll(intentionalDonationLink, "");
}

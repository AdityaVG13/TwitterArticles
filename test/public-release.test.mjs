import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const thisFile = fileURLToPath(import.meta.url);
const scannedRoots = [
  ".env.example",
  ".github",
  ".gitignore",
  ".husky",
  ".lintstagedrc",
  ".prettierrc",
  "CONTEXT.md",
  "LICENSE",
  "README.md",
  "extension",
  "native-host",
  "package.json",
  "public",
  "scripts",
  "src",
  "test",
];
const ignoredDirs = new Set([
  ".git",
  "downloads",
  "node_modules",
  ".xad-browser-profile",
]);
const personalName = String.fromCharCode(97, 100, 105, 116, 121, 97);
const loopbackName = ["local", "host"].join("");
const fixedLocalOrigin = `http://${loopbackName}:4512`;
const forbidden = [
  {
    label: "personal macOS home path",
    pattern: new RegExp(`/${["Users", personalName].join("/")}`, "i"),
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
    label: "fixed localhost port",
    pattern: new RegExp(escapeRegExp(fixedLocalOrigin), "i"),
  },
];

test("public release files do not contain personal development references", async () => {
  const files = await listScannedFiles();
  const failures = [];
  for (const file of files) {
    if (file === thisFile) {
      continue;
    }
    const content = await readFile(file, "utf8");
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

async function listScannedFiles() {
  const files = [];
  for (const entry of scannedRoots) {
    await collect(path.join(rootDir, entry), files);
  }
  return files;
}

async function collect(target, files) {
  const entries = await readdir(target, { withFileTypes: true }).catch(
    () => null
  );
  if (!entries) {
    files.push(target);
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        await collect(path.join(target, entry.name), files);
      }
    } else if (entry.isFile()) {
      files.push(path.join(target, entry.name));
    }
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const sourceSvg = path.join(rootDir, "extension", "icons", "icon.svg");
const outputDir = path.join(rootDir, "extension", "icons");

const sizes = [16, 32, 48, 128];
const svg = await readFile(sourceSvg, "utf8");

for (const size of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  const png = resvg.render().asPng();
  const outPath = path.join(outputDir, `icon-${size}.png`);
  await writeFile(outPath, png);
  console.log(`wrote ${path.relative(rootDir, outPath)} (${png.length} bytes)`);
}

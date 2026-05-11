#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const screenshotDir = path.join(rootDir, "docs", "screenshots");

const shots = [
  { name: "popup-single", width: 816 },
  { name: "popup-batch", width: 816 },
];

for (const shot of shots) {
  const svgPath = path.join(screenshotDir, `${shot.name}.svg`);
  const svg = await readFile(svgPath, "utf8");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: shot.width },
    background: "rgba(0,0,0,0)",
  });
  const png = resvg.render().asPng();
  const out = path.join(screenshotDir, `${shot.name}.png`);
  await writeFile(out, png);
  console.log(`wrote ${path.relative(rootDir, out)} (${png.length} bytes)`);
}

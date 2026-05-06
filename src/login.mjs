import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { openLoginWithBrowserHarness } from "./browser-harness.mjs";

await openLoginWithBrowserHarness();
console.log("Log in to X in the opened browser window.");
console.log(
  "After the Articles tab or home timeline loads, return here and press Enter."
);
const rl = readline.createInterface({ input, output });
await rl.question("");
rl.close();
console.log("Browser Harness will reuse this browser profile for downloads.");

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createBrowserContext } from './extractor.mjs';

const context = await createBrowserContext({ headless: false });
const page = await context.newPage();
await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });

console.log('Log in to X in the opened browser window.');
console.log('After the Articles tab or home timeline loads, return here and press Enter.');

const rl = readline.createInterface({ input, output });
await rl.question('');
rl.close();
await context.close();
console.log('Saved login cookies in .xad-browser-profile/');

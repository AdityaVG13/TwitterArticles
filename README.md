# X Article Downloader

Export X Articles and long-form status pages to Markdown, PDF, DOCX, or ZIP from a local browser session.

The app runs locally. It does not send article content to a third-party service. It uses Playwright when run from the web UI or CLI, and a Chrome-compatible extension plus Native Messaging host for one-click exports from the current tab.

## Features

- Export one or many `x.com`, `twitter.com`, or `mobile.twitter.com` URLs.
- Save Markdown, PDF, DOCX, or a ZIP when multiple files are produced.
- Reuse a local authenticated browser profile for subscriber-only or otherwise gated pages.
- Use the Chrome extension to capture the rendered current tab and start or stop the local server automatically.
- Override output folder, browser profile, and server port with environment variables.

## Requirements

- macOS for the included Native Messaging installer.
- Node.js 20 or newer.
- Chrome, Chrome Canary, Chromium, Brave, or Microsoft Edge for the extension workflow.

## Install

```sh
npm install
```

If Playwright asks for a browser:

```sh
npx playwright install chromium
```

## Web UI

```sh
npm start
```

Open:

```text
http://127.0.0.1:4512
```

Paste URLs, choose formats, and download the results. Files are written to `downloads/`.

## Authenticated Pages

```sh
npm run login
```

Log in to X in the opened browser, wait for the home timeline or Articles page to load, then press Enter in the terminal. Cookies are saved locally in `.xad-browser-profile/`.

## Browser Extension

Install the Native Messaging host:

```sh
npm run install-native
```

Then load the extension:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Choose the `extension/` directory from this repo.

The installer prints the extension ID and manifest path. The default unpacked extension ID is:

```text
hphgjlnkhoocfnhpdabnhjddfdknkmkd
```

The Native Messaging manifest is written under the selected browser's profile support directory, for example:

```text
~/Library/Application Support/Google/Chrome/NativeMessagingHosts/org.x_article_downloader.native_host.json
```

The launcher is written to:

```text
~/Library/Application Support/XArticleDownloaderNativeHost/run-host.sh
```

Supported browser targets:

```sh
npm run install-native -- --browser chrome
npm run install-native -- --browser canary
npm run install-native -- --browser chromium
npm run install-native -- --browser brave
npm run install-native -- --browser edge
```

Use the extension button from an open X Article or status tab. In native mode, the extension starts the local server if needed, captures the rendered tab, exports the selected formats, and downloads the result. When the extension disconnects, the managed server shuts down after its idle timeout.

To remove the Native Messaging host:

```sh
npm run uninstall-native
```

## CLI

```sh
node src/cli.mjs --formats md,pdf,docx --zip https://x.com/user/status/123
```

Options:

```text
--formats md,pdf,docx   Comma-separated output formats
--out DIR               Output directory
--zip                   Create x-articles.zip
--headful               Show the browser while extracting
```

## Browser Harness Helper

From the repo root:

```sh
npm start
bh-user https://x.com/user/status/123
bh <<'PY'
exec(open("scripts/bh-download-current-x-article.py").read())
print(download_current_x_article(formats=["md", "pdf", "docx"]))
PY
```

## Configuration

Environment variables:

```text
XAD_PORT=4512
XAD_OUTPUT_DIR=./downloads
XAD_USER_DATA_DIR=./.xad-browser-profile
XAD_HEADLESS=false
XAD_SERVER_IDLE_MS=120000
XAD_NATIVE_IDLE_MS=180000
XAD_NATIVE_START_TIMEOUT_MS=15000
```

The extension defaults to `http://127.0.0.1:4512`, but the server origin can be changed in the extension options page.

## Notes

- Default input is restricted to `x.com`, `twitter.com`, and `mobile.twitter.com`.
- Markdown and PDF preserve images as remote links or assets. DOCX preserves text structure and image URLs.
- If extraction reports a login, rate-limit, or interstitial page, run `npm run login` and retry.
- Use this for content you have rights to access and store.

## Development

```sh
npm run check
npm test
```

Optional PDF smoke test:

```sh
npm run test:pdf
```

## License

MIT

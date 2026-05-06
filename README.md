# X Article Downloader

Export X Articles and long-form status pages to Markdown, PDF, DOCX, or ZIP from a local browser session.

The app runs locally. It does not send article content to a third-party service.

Use the web UI or CLI for pasted URLs. Use the browser extension for one-click exports from the current rendered tab.

## Features

- Export one or many `x.com`, `twitter.com`, or `mobile.twitter.com` URLs.
- Save Markdown, PDF, DOCX, or ZIP output.
- Reuse a Browser Harness Chrome profile for gated pages.
- Capture the current rendered tab with the Chrome-compatible extension.
- Start and stop the local server from the extension via Native Messaging.
- Override output folder, Browser Harness command, server port, and trusted origins.

## Requirements

- Node.js 20 or newer.
- Browser Harness installed with `browser-harness` on `PATH`.
- Chrome on macOS, Linux, or Windows for the Native Messaging installer.
- Chrome Canary, Chromium, Brave, or Microsoft Edge native installer targets are available on macOS.

## Install

```sh
npm install
npm run doctor
```

Install Browser Harness if needed:

```sh
git clone https://github.com/browser-use/browser-harness
cd browser-harness
uv tool install -e .
browser-harness --setup
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

Log in to X in the opened browser. Wait for the home timeline or Articles page to load, then press Enter in the terminal.

Cookies stay in the Chrome profile Browser Harness is attached to.

## Browser Extension

Install the Native Messaging host:

```sh
npm run install-native
```

Load the extension:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Choose the `extension/` directory from this repo.

The installer prints the extension ID and manifest path. The default unpacked extension ID is:

```text
hphgjlnkhoocfnhpdabnhjddfdknkmkd
```

That default command supports Google Chrome on macOS, Linux, and Windows. The installer prints the exact Native Messaging manifest path, extension ID, and local launcher path for your browser.

Additional macOS browser targets:

```sh
npm run install-native -- --browser canary
npm run install-native -- --browser chromium
npm run install-native -- --browser brave
npm run install-native -- --browser edge
```

Use the extension button from an open X Article or status tab. In native mode, the extension starts the local server if needed, captures the rendered tab, exports files, and downloads the result.

When the extension disconnects, the managed server shuts down after its idle timeout.

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
XAD_ALLOWED_ORIGINS=http://127.0.0.1:4512
XAD_BROWSER_HARNESS_COMMAND=browser-harness
XAD_SERVER_IDLE_MS=120000
XAD_NATIVE_IDLE_MS=180000
XAD_NATIVE_START_TIMEOUT_MS=15000
```

By default, the server trusts its loopback web UI origins and the bundled extension ID.

If you build the extension with a different key, set `XAD_ALLOWED_ORIGINS` to include that extension origin.

## Security Model

- The server binds only to `127.0.0.1`.
- The extension and Native Messaging host accept only loopback HTTP server origins with explicit user ports.
- Browser API requests are protected by an origin allowlist and security headers.
- Download paths are validated before files are served.
- `/health` does not expose your local output directory.
- Article content is processed locally and is not uploaded to a third-party service.
- Browser automation uses Browser Harness only.

See [SECURITY.md](SECURITY.md) for permission details and release checks.

## Notes

- Default input is restricted to `x.com`, `twitter.com`, and `mobile.twitter.com`.
- Markdown and PDF preserve images as remote links or assets.
- DOCX preserves text structure and image URLs.
- If extraction reports a login, rate-limit, or interstitial page, run `npm run login` and retry.
- Use this for content you have rights to access and store.

## Development

```sh
npm run format:check
npm run check
npm test
npm run audit
```

Optional PDF smoke test:

```sh
npm run test:pdf
```

Local artifact malware/security scan:

```sh
npm run security:scan
```

Optional VirusTotal hash lookup:

```sh
VIRUSTOTAL_API_KEY=... npm run security:virustotal
```

To submit the generated package artifact to VirusTotal:

```sh
VIRUSTOTAL_API_KEY=... npm run security:virustotal -- --upload
```

Pre-commit hooks run staged formatting, syntax checks, and tests.

## License

MIT

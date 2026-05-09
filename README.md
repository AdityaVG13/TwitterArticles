# X Article Downloader

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-2f6f4e?style=flat-square)](#requirements)
[![License MIT](https://img.shields.io/badge/license-MIT-2f2f2f?style=flat-square)](LICENSE)
[![Local first](https://img.shields.io/badge/local--first-no%20cloud%20upload-3f5f7f?style=flat-square)](#security-model)
[![Support on Ko-fi](https://img.shields.io/badge/Support-Ko--fi-ff5f5f?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/adityavg13)

Export X Articles and long-form status pages from your own browser session to Markdown, PDF, DOCX, or ZIP.

The app is local-first. Article content is processed on your machine, the web server binds to `127.0.0.1`, and authenticated captures reuse your own Chrome profile through Browser Harness.

| Use case                         | Best path                    |
| -------------------------------- | ---------------------------- |
| Paste one or many X URLs         | Run the local web UI         |
| Save the current rendered tab    | Install the Chrome extension |
| Automate exports from scripts    | Use the CLI                  |
| Capture gated or logged-in pages | Use Browser Harness login    |

Generated file names use the article title and tweet author when page metadata is available.

## AI Install Prompt

Paste this into an AI coding agent with terminal access, along with this repository's URL.

<details open>
<summary>Copy-paste install prompt</summary>

```text
Install X Article Downloader from the repository URL I provide.

Use a clean working directory. Detect my OS. Make sure Git, Node.js 20 or newer, uv, and Chrome are installed. Clone the repository, run npm install, then run npm run doctor.

If Browser Harness is missing, install it from its official repository using the README commands, then rerun npm run doctor. After the doctor passes, run npm run install-native for Google Chrome. Tell me the extension directory printed by the installer and walk me through loading it in chrome://extensions with Developer mode enabled.

Do not ask me for secrets. Do not modify the project source. Stop and show the exact command output if any step fails.
```

</details>

## Quick Start

Install dependencies and run the doctor:

```sh
npm install
npm run doctor
```

Start the local UI:

```sh
npm start
```

Open:

```text
http://127.0.0.1:4512
```

Paste X Article or status URLs, choose formats, and download the results. Files are written to `downloads/`.

## Requirements

| Requirement                        | Why it is needed                                        |
| ---------------------------------- | ------------------------------------------------------- |
| Node.js 20 or newer                | Runs the local server, CLI, exporters, and native host  |
| Browser Harness on `PATH`          | Opens Chrome and captures authenticated pages           |
| Chrome on macOS, Linux, or Windows | Required for the Native Messaging installer             |
| uv                                 | Installs Browser Harness if it is not already available |

Install Browser Harness if `npm run doctor` reports it missing:

```sh
git clone https://github.com/browser-use/browser-harness
cd browser-harness
uv tool install -e .
browser-harness --setup
```

## Chrome Extension

The extension gives you one-click export from the current X Article or status tab. In native mode, it starts the local server when needed, captures the rendered tab, exports files, and downloads the result.

Install the Native Messaging host for Google Chrome:

```sh
npm run install-native
```

Load the unpacked extension:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Choose the `extension/` directory from this repo.

The installer prints the extension directory, extension ID, manifest path, and local launcher path. The default unpacked extension ID is:

```text
hphgjlnkhoocfnhpdabnhjddfdknkmkd
```

Google Chrome Native Messaging install support:

| OS      | Default command          |
| ------- | ------------------------ |
| macOS   | `npm run install-native` |
| Linux   | `npm run install-native` |
| Windows | `npm run install-native` |

Additional macOS browser targets:

```sh
npm run install-native -- --browser canary
npm run install-native -- --browser chromium
npm run install-native -- --browser brave
npm run install-native -- --browser edge
```

When the extension disconnects, the managed server shuts down after its idle timeout.

Remove the Native Messaging host:

```sh
npm run uninstall-native
```

## Firefox Extension

Firefox uses a separate built extension directory and its own Native Messaging host registration. The build script transforms the Chrome MV3 manifest into a Firefox-compatible event-page MV3 manifest with a stable gecko id.

Install the Native Messaging host for Firefox (also runs the build):

```sh
npm run install-native -- --browser firefox
```

This writes `extension-firefox/` and registers the host under the Mozilla Native Messaging path (`HKCU\Software\Mozilla\NativeMessagingHosts\...` on Windows, `Library/Application Support/Mozilla/NativeMessagingHosts` on macOS, `.mozilla/native-messaging-hosts` on Linux).

Load the temporary add-on:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on`.
3. Choose `extension-firefox/manifest.json`.

Firefox extension id:

```text
x-article-downloader@native.local
```

Temporary add-ons are removed when Firefox restarts. To persist across restarts, sign and submit through addons.mozilla.org or run an Unbranded/Developer Edition build with signature checks disabled.

Build the Firefox extension without registering the host:

```sh
npm run build:firefox
```

Remove the Firefox host:

```sh
npm run uninstall-native -- --browser firefox
```

## Authenticated Pages

Use this when X returns a login wall, rate-limit page, interstitial, or incomplete article.

```sh
npm run login
```

Log in to X in the opened browser. Wait for the home timeline or Articles page to load, then press Enter in the terminal.

Browser Harness stores cookies in the Chrome profile it controls. The app does not ask for your X credentials.

## CLI

Export from a script or terminal:

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

Capture the current logged-in tab from Browser Harness:

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
- Article content is processed locally and is not uploaded to a third-party service.
- The extension and Native Messaging host accept only loopback HTTP server origins with explicit user ports.
- Browser API requests are protected by an origin allowlist and security headers.
- Download paths are validated before files are served.
- `/health` does not expose your local output directory.
- Browser automation uses Browser Harness only.

See [SECURITY.md](SECURITY.md) for permissions, threat model details, and release checks.

## Notes

- Default input is restricted to `x.com`, `twitter.com`, and `mobile.twitter.com`.
- Markdown and PDF preserve images as remote links or assets.
- DOCX preserves text structure and image URLs.
- Use this for content you have rights to access and store.

## Development

Core checks:

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

Submit the generated package artifact to VirusTotal:

```sh
VIRUSTOTAL_API_KEY=... npm run security:virustotal -- --upload
```

Pre-commit hooks run staged formatting, syntax checks, and tests.

## Support This Work

If X Article Downloader saves you time, donations help fund maintenance, testing, documentation, and more open-source tools.

[![Support on Ko-fi](https://img.shields.io/badge/Support-Ko--fi-ff5f5f?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/adityavg13)

## License

MIT

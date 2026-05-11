<div align="center">

<img src="extension/icons/icon-128.png" alt="X Article Downloader" width="96" height="96">

# X Article Downloader

**Save X Articles and long-form posts to Markdown, PDF, DOCX, or ZIP — on your own machine.**

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-2f6f4e?style=flat-square)](#requirements)
[![License MIT](https://img.shields.io/badge/license-MIT-2f2f2f?style=flat-square)](LICENSE)
[![Local first](https://img.shields.io/badge/local--first-no%20cloud%20upload-3f5f7f?style=flat-square)](#security-model)
[![Chrome + Firefox](https://img.shields.io/badge/browser-Chrome%20%2B%20Firefox-d97757?style=flat-square)](#browser-extension)
[![Support on Ko-fi](https://img.shields.io/badge/Support-Ko--fi-ff5f5f?style=flat-square&logo=ko-fi&logoColor=white)](https://ko-fi.com/adityavg13)

</div>

The server binds to `127.0.0.1`, the extension only talks to that loopback origin, and authenticated captures reuse your own browser session through Browser Harness. Nothing is uploaded.

| You want to...                       | Use                              |
| ------------------------------------ | -------------------------------- |
| Paste one or many X URLs             | Local web UI (`npm start`)       |
| Save the X tab you're looking at     | Extension popup, **Single** mode |
| Queue several tabs into one ZIP      | Extension popup, **Batch** mode  |
| Capture a logged-in or gated page    | `npm run login` + Browser Harness |
| Script exports                       | CLI (`src/cli.mjs`)              |

Generated file names use the article title and tweet author when page metadata is available.

---

## Quick Start

From a fresh clone of this repo:

```sh
npm install
npm run doctor
```

Then pick one:

**Web UI** — paste URLs, click download.

```sh
npm start
# open http://127.0.0.1:4512
```

**Browser extension** — capture the tab you're already reading.

```sh
# Chrome / Edge / Brave
npm run install-native
# then load extension/ at chrome://extensions (Developer mode on)

# Firefox -- one command, opens a dev profile with the extension preloaded
npm run install-native -- --browser firefox
npm run run:firefox
```

Files land in `./downloads/` (web UI / CLI) or your browser's default downloads folder (extension).

<details>
<summary><strong>AI install prompt</strong> — paste into an agent with terminal access</summary>

```text
Install X Article Downloader from the repository URL I provide.

Use a clean working directory. Detect my OS. Make sure Git, Node.js 20 or
newer, uv, and Chrome are installed. Clone the repository, run npm install,
then run npm run doctor.

If Browser Harness is missing, install it from its official repository using
the README commands, then rerun npm run doctor. After the doctor passes, run
npm run install-native for Google Chrome. Tell me the extension directory
printed by the installer and walk me through loading it in chrome://extensions
with Developer mode enabled.

Do not ask me for secrets. Do not modify the project source. Stop and show
the exact command output if any step fails.
```

</details>

---

## Requirements

| Requirement                | Why                                                     |
| -------------------------- | ------------------------------------------------------- |
| Node.js 20+                | Runs the local server, CLI, exporters, and native host  |
| Browser Harness on `PATH`  | Opens Chrome and captures authenticated pages           |
| Chrome **or** Firefox 115+ | Hosts the extension and the Native Messaging registration |
| uv                         | Installs Browser Harness if it isn't already available  |

Install Browser Harness if `npm run doctor` reports it missing:

```sh
git clone https://github.com/browser-use/browser-harness
cd browser-harness
uv tool install -e .
browser-harness --setup
```

---

## Browser Extension

Toolbar button → capture the X Article in the active tab, or queue several tabs and ZIP them together. The extension launches the local server on demand (managed mode) and stops it after the idle timeout when you walk away.

<div align="center">

<img src="extension/icons/icon-128.png" alt="App icon" width="64" height="64">

</div>

### Chrome, Edge, Brave, Chromium, Canary

```sh
npm run install-native
```

Then load the unpacked extension:

1. Open `chrome://extensions`
2. Toggle **Developer mode**
3. **Load unpacked** → select the `extension/` directory

The default unpacked extension ID is `hphgjlnkhoocfnhpdabnhjddfdknkmkd`. The installer prints the extension directory, manifest path, and launcher path.

Other Chromium targets on macOS:

```sh
npm run install-native -- --browser canary
npm run install-native -- --browser chromium
npm run install-native -- --browser brave
npm run install-native -- --browser edge
```

Uninstall:

```sh
npm run uninstall-native
```

### Firefox 115+

Firefox uses a separate built directory (`extension-firefox/`) with a Firefox-flavored MV3 manifest. The build script transforms the Chrome manifest into a Gecko-compatible one with a stable extension id.

First, install the Firefox Native Messaging host (also runs the build):

```sh
npm run install-native -- --browser firefox
```

Then pick how you want to load the extension.

<table>
<tr><th width="33%">A. One-command dev run <em>(recommended)</em></th><th width="33%">B. Drag-and-drop XPI</th><th width="33%">C. Manual sideload</th></tr>
<tr><td>

Builds the extension and launches Firefox with a persisted dev profile and the add-on auto-loaded. Login and settings survive between runs.

```sh
npm run run:firefox
```

Same flow for Chromium:

```sh
npm run run:chrome
```

</td><td>

Produces an unsigned `.xpi` you can drag into `about:addons` on Firefox **Developer Edition, Nightly, or ESR** with `xpinstall.signatures.required = false` set in `about:config`. Persists across browser restarts.

```sh
npm run package:firefox
# dist/x_article_downloader-<v>.zip
```

</td><td>

Stock Firefox, no extra processes. Add-on is removed when Firefox restarts.

1. `npm run build:firefox`
2. `about:debugging#/runtime/this-firefox`
3. **Load Temporary Add-on**
4. Pick `extension-firefox/manifest.json`

</td></tr>
</table>

Firefox extension id:

```text
x-article-downloader@native.local
```

Uninstall the host:

```sh
npm run uninstall-native -- --browser firefox
```

---

## Capture Modes

Click the toolbar icon to open the popup. Two modes, toggled at the top.

### Single

Capture the current tab and download it in the configured formats.

```text
┌──────────────────────────────────────────────────────┐
│  X Article Downloader                                │
│                                                      │
│  ┌─────────────────┐┌─────────────────┐              │
│  │  ● Single       ││    Batch        │              │
│  └─────────────────┘└─────────────────┘              │
│                                                      │
│  Capture the current X Article tab.                  │
│                                                      │
│  ┌─────────────────────┐                             │
│  │  Capture this tab   │                             │
│  └─────────────────────┘                             │
│                                                      │
│  Saved 1 file.                            Options →  │
└──────────────────────────────────────────────────────┘
```

### Batch

Queue tabs from anywhere in your browser, review them, then download the whole queue as one archive (up to 50 articles).

```text
┌──────────────────────────────────────────────────────┐
│  X Article Downloader                                │
│                                                      │
│  ┌─────────────────┐┌─────────────────┐              │
│  │    Single       ││  ● Batch        │              │
│  └─────────────────┘└─────────────────┘              │
│                                                      │
│  ┌─────────────────────┐               3 queued      │
│  │    Add this tab     │                             │
│  └─────────────────────┘                             │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Why agents will eat the IDE     @balajis     × │  │
│  │ Notes on local-first software   @inkswitch   × │  │
│  │ A short essay on quiet UI       @rms         × │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Formats   [x] Markdown    [ ] PDF    [ ] DOCX       │
│                                                      │
│  ┌──────────────────┐  ┌─────────┐                   │
│  │   Save to ZIP    │  │  Clear  │                   │
│  └──────────────────┘  └─────────┘                   │
│                                                      │
│  Saved 3 article(s). ZIP downloaded.      Options →  │
└──────────────────────────────────────────────────────┘
```

The toolbar badge shows the queue count while batch mode is active.

The ZIP lands in your browser's default download folder. Each article is named by its title and author:

```text
~/Downloads/
└── Twitter Download - 2026-05-09.zip
    ├── Why agents will eat the IDE - @balajis.md
    ├── Notes on local-first software - @inkswitch.md
    └── A short essay on quiet UI - @rms.md
```

Mode is stored per browser profile and survives sessions. The options page exposes the same toggle.

---

## Authenticated Pages

When X returns a login wall, interstitial, rate-limit page, or incomplete article:

```sh
npm run login
```

Log into X in the opened browser. Wait for the home timeline or Articles page to load, then press Enter in the terminal. Cookies stay in the Chrome profile Browser Harness controls. The app never asks for your X credentials.

---

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

### Browser Harness helper

Capture the tab you're already logged into:

```sh
npm start
bh-user https://x.com/user/status/123
bh <<'PY'
exec(open("scripts/bh-download-current-x-article.py").read())
print(download_current_x_article(formats=["md", "pdf", "docx"]))
PY
```

---

## Configuration

<details>
<summary>Environment variables</summary>

```text
XAD_PORT=4512
XAD_OUTPUT_DIR=./downloads
XAD_ALLOWED_ORIGINS=http://127.0.0.1:4512
XAD_BROWSER_HARNESS_COMMAND=browser-harness
XAD_SERVER_IDLE_MS=120000
XAD_NATIVE_IDLE_MS=180000
XAD_NATIVE_START_TIMEOUT_MS=15000
```

By default the server trusts its loopback web UI origins, the bundled Chrome extension id, and any `moz-extension://` origin (Firefox UUIDs are profile-random for unsigned installs; the real access gate is the native host's `allowed_extensions` list). Set `XAD_ALLOWED_ORIGINS` explicitly if you're hosting the extension under a different Chrome key.

</details>

---

## Security Model

- Server binds to `127.0.0.1` only.
- Article content is processed locally; nothing leaves the machine.
- The extension and Native Messaging host accept only loopback HTTP origins with explicit user ports.
- Browser API requests pass through an origin allowlist and security headers; non-JSON responses surface their HTTP status and body snippet instead of crashing the popup.
- Download paths are validated before files are served.
- `/health` does not expose your output directory.
- Browser automation is Browser Harness only.

See [SECURITY.md](SECURITY.md) for permissions, threat model, and release checks.

---

## Notes

- Input is restricted to `x.com`, `twitter.com`, and `mobile.twitter.com`.
- Markdown and PDF preserve images as remote links or embedded assets.
- DOCX preserves text structure and image URLs.
- Use only for content you have rights to access and store.

---

## Development

```sh
npm run format:check    # prettier
npm run check           # syntax + manifest sanity
npm test                # full suite (60 tests)
npm run audit           # production deps only
```

Icon pipeline (master SVG → 16/32/48/128 PNGs via `@resvg/resvg-js`):

```sh
npm run build:icons
```

Optional checks:

```sh
npm run test:pdf                   # PDF exporter smoke test
npm run security:scan              # local artifact scan
VIRUSTOTAL_API_KEY=... npm run security:virustotal
```

---

## Support

If this saves you time, donations keep maintenance, testing, and new tooling moving.

<div align="center">

[![Support on Ko-fi](https://img.shields.io/badge/Support-Ko--fi-ff5f5f?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/adityavg13)

</div>

## License

MIT

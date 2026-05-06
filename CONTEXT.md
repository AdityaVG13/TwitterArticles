# X Article Downloader Context

## Domain Language

- **X Article**: a long-form post or status page on `x.com`, `twitter.com`, or `mobile.twitter.com`.
- **Captured Article**: article content extracted from a rendered browser tab by the extension or Browser Harness helper.
- **Downloaded Article**: article content extracted by Playwright from a URL supplied to the web UI or CLI.
- **Export Format**: one of Markdown, PDF, or DOCX.
- **Download Run**: one invocation that writes exported files into a timestamped directory under the output directory.
- **Managed Server**: the local HTTP server started by the Native Messaging host for the extension workflow.
- **Native Messaging Host**: the local process Chrome-compatible browsers use to start, stop, and inspect the Managed Server.
- **Browser Profile**: the local Playwright profile used to store X login cookies.

## Architecture Notes

- URL normalization lives in `src/url.mjs`.
- Captured Article validation lives in `src/capture.mjs`.
- HTML extraction and sanitization live in `src/extractor.mjs`.
- File rendering and ZIP creation live in `src/exporters.mjs`.
- Local HTTP origin checks live in `src/access-control.mjs`.
- Native Messaging setup and manifest generation live in `src/native-host-config.mjs` and `src/install-native.mjs`.

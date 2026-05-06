# Security Policy

## Security Model

X Article Downloader is a local-first tool.

- The web server binds to `127.0.0.1`, not a public network interface.
- The extension accepts only explicit `http://127.0.0.1:<port>` or `http://localhost:<port>` server origins.
- The Native Messaging host rejects non-loopback server origins before starting a managed server.
- Browser requests are protected by an origin allowlist, JSON-only API input, and security headers.
- Download routes validate path segments before serving files from the configured output directory.
- `/health` reports readiness only. It does not expose the local output path.
- Browser automation uses Browser Harness only.
- Article content is processed locally. The app does not upload article content to a third-party service.

The tool can still fetch requested web pages and remote image URLs because exporting an article requires reading the page you ask it to export.

## Extension Permissions

The extension requests:

- `activeTab` and `scripting` to capture the current X Article or status tab after the user clicks the extension button.
- `downloads` to save the exported file.
- `nativeMessaging` to start and stop the local server through the installed host.
- `storage` to save local options.

Host permissions are limited to X/Twitter pages and loopback HTTP origins.

## Dependency Checks

Run the local release checks before publishing:

```sh
npm run format:check
npm run check
npm test
npm run audit
npm pack --dry-run
```

`npm run audit` fails on high severity production dependency advisories.

## Reporting A Vulnerability

Use GitHub private vulnerability reporting for this repository if it is enabled. If it is not enabled, open a GitHub issue with a minimal reproduction and avoid posting secrets, cookies, tokens, or private article content.

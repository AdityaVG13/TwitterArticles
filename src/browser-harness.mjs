import { spawn } from "node:child_process";

const RESULT_PREFIX = "__XAD_BROWSER_HARNESS_RESULT__ ";
const DEFAULT_TIMEOUT_MS = 60000;

export function browserHarnessCommand() {
  return process.env.XAD_BROWSER_HARNESS_COMMAND || "browser-harness";
}

export async function capturePageWithBrowserHarness(url, options = {}) {
  const timeoutSeconds = Math.ceil((options.timeoutMs || 45000) / 1000);
  const settleSeconds = Number(options.settleMs ?? 900) / 1000;
  const browserHarnessTimeoutMs =
    options.browserHarnessTimeoutMs ||
    Math.max(DEFAULT_TIMEOUT_MS, (options.timeoutMs || 45000) + 15000);
  const clickExpression = `(() => {
    const labels = [/show more/i, /show this thread/i, /read more/i];
    const candidates = [...document.querySelectorAll('button, [role="button"], a')];
    for (const label of labels) {
      const node = candidates.find((item) => label.test(item.innerText || item.textContent || ''));
      if (node) node.click();
    }
    return true;
  })()`;
  const extractExpression = `(() => JSON.stringify({
    html: document.documentElement.outerHTML,
    title: document.title.replace(/^🟢\\s*/, ''),
    bodyText: document.body?.innerText?.slice(0, 8000) || '',
    location: location.href
  }))()`;
  const script = `
import json
target = ${pythonString(url)}
tab = new_tab(target)
try:
    wait_for_load(${pythonNumber(timeoutSeconds)})
    wait(${pythonNumber(settleSeconds)})
    js(${pythonString(clickExpression)})
    wait(${pythonNumber(settleSeconds)})
    result = js(${pythonString(extractExpression)})
    print(${pythonString(RESULT_PREFIX)} + result)
finally:
    try:
        cdp("Target.closeTarget", targetId=tab)
    except Exception:
        pass
`;
  const stdout = await runBrowserHarness(script, {
    timeoutMs: browserHarnessTimeoutMs,
  });
  return parseBrowserHarnessResult(stdout);
}

export async function openLoginWithBrowserHarness(url = "https://x.com/login") {
  const script = `new_tab(${pythonString(url)})\n`;
  await runBrowserHarness(script, {
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
}

export function parseBrowserHarnessResult(stdout) {
  const line = String(stdout)
    .split(/\r?\n/)
    .reverse()
    .find((item) => item.startsWith(RESULT_PREFIX));
  if (!line) {
    throw new Error("Browser Harness did not return an X Article result.");
  }
  return JSON.parse(line.slice(RESULT_PREFIX.length));
}

export function runBrowserHarness(script, options = {}) {
  const command = options.command || browserHarnessCommand();
  const args = options.args || ["-c", "-"];
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill("SIGTERM");
      reject(new Error(`Browser Harness timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (error.code === "ENOENT") {
        reject(new Error(`Browser Harness command not found: ${command}`));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const combined = `${stderr}\n${stdout}`;
      if (/remote.debugging|Allow remote debugging|chrome:\/\/inspect/i.test(combined)) {
        reject(
          new Error(
            "Browser Harness can't reach Chrome. Open chrome://inspect/#remote-debugging, " +
              "enable 'Allow remote debugging for this browser instance', then retry. " +
              "Run `browser-harness --doctor` for details."
          )
        );
        return;
      }
      reject(
        new Error(
          [
            `Browser Harness exited with code ${code}.`,
            stderr.trim(),
            stdout.trim(),
          ]
            .filter(Boolean)
            .join("\n")
        )
      );
    });
    child.stdin.end(script);
  });
}

function pythonString(value) {
  return JSON.stringify(String(value));
}

function pythonNumber(value) {
  return Number.isFinite(value) ? String(value) : "0";
}

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
    args: options.browserHarnessArgs || [
      "--run-local",
      "--headless",
      "about:blank",
    ],
    timeoutMs: browserHarnessTimeoutMs,
  });
  return parseBrowserHarnessResult(stdout);
}

export async function writeHtmlPdfWithBrowserHarness(
  html,
  filePath,
  options = {}
) {
  const script = `
import base64
import json
html = base64.b64decode(${pythonString(Buffer.from(html, "utf8").toString("base64"))}).decode("utf-8")
file_path = ${pythonString(filePath)}
tab = new_tab("about:blank")
try:
    js("document.open(); document.write(" + json.dumps(html) + "); document.close();")
    wait_for_load(5)
    wait(0.5)
    cdp("Emulation.setEmulatedMedia", media="print")
    pdf = cdp(
        "Page.printToPDF",
        printBackground=True,
        paperWidth=8.27,
        paperHeight=11.69,
        marginTop=0.2,
        marginRight=0.2,
        marginBottom=0.2,
        marginLeft=0.2,
    )
    open(file_path, "wb").write(base64.b64decode(pdf["data"]))
    print(${pythonString(RESULT_PREFIX)} + json.dumps({"ok": True, "path": file_path}))
finally:
    try:
        cdp("Target.closeTarget", targetId=tab)
    except Exception:
        pass
`;
  await runBrowserHarness(script, {
    args: ["--run-local", "--headless", "about:blank"],
    timeoutMs: options.pdfTimeoutMs || DEFAULT_TIMEOUT_MS,
  });
}

export async function openLoginWithBrowserHarness(url = "https://x.com/login") {
  await runBrowserHarness("", {
    args: ["--launch-local", url],
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
  const args = options.args || [];
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

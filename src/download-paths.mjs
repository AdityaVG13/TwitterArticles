import path from "node:path";

export function downloadFilePath(downloadRoot, runId, fileName) {
  const root = path.resolve(downloadRoot);
  assertSafeSegment(runId, "run id");
  assertSafeSegment(fileName, "file name");

  const requested = path.resolve(root, runId, fileName);
  const relative = path.relative(root, requested);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid download path.");
  }

  return requested;
}

function assertSafeSegment(value, label) {
  const text = String(value || "");
  if (
    !text ||
    text === "." ||
    text === ".." ||
    text.includes("\0") ||
    text.includes("/") ||
    text.includes("\\")
  ) {
    throw new Error(`Invalid ${label}.`);
  }
}

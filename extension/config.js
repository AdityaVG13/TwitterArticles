export const DEFAULT_OPTIONS = {
  serverOrigin: "http://127.0.0.1:4512",
  serverMode: "native",
  formats: ["md"],
  zip: true,
  captureMode: "single",
};

export const BATCH_QUEUE_LIMIT = 50;

export const NATIVE_HOST_NAME = "org.x_article_downloader.native_host";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function normalizeServerOrigin(value = DEFAULT_OPTIONS.serverOrigin) {
  let url;
  try {
    url = new URL(String(value || DEFAULT_OPTIONS.serverOrigin));
  } catch {
    throw new Error("Local server must be a valid URL.");
  }

  if (url.protocol !== "http:") {
    throw new Error("Local server must use HTTP.");
  }

  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Local server must use a loopback host.");
  }

  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Local server must include a port from 1024 to 65535.");
  }

  return `http://${url.hostname}:${port}`;
}

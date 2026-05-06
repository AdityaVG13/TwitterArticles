const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function normalizeLoopbackOrigin(origin, fallbackPort) {
  if (!origin) {
    return `http://127.0.0.1:${normalizePort(fallbackPort)}`;
  }

  let url;
  try {
    url = new URL(String(origin));
  } catch {
    throw new Error("Invalid local server origin.");
  }

  if (url.protocol !== "http:") {
    throw new Error("Local server origin must use HTTP.");
  }

  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Local server origin must be a loopback host.");
  }

  const port = normalizePort(url.port);
  return `http://${url.hostname}:${port}`;
}

export function normalizePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Local server port must be between 1024 and 65535.");
  }

  return port;
}

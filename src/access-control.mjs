export function defaultAllowedOrigins({ port, extensionId } = {}) {
  const resolvedPort = Number(port || 4512);
  const origins = [
    `http://127.0.0.1:${resolvedPort}`,
    `http://localhost:${resolvedPort}`,
  ];
  if (extensionId) {
    origins.push(`chrome-extension://${extensionId}`);
  }
  return origins;
}

export function parseAllowedOrigins(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createAccessControlMiddleware({ allowedOrigins = [] } = {}) {
  const allowed = new Set(
    allowedOrigins.map((origin) => normalizeOrigin(origin))
  );
  return (req, res, next) => {
    const origin = req.headers.origin;
    res.setHeader("Vary", appendVary(res.getHeader("Vary"), "Origin"));
    res.setHeader("Access-Control-Allow-Headers", "content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (!origin) {
      next();
      return;
    }
    if (!allowed.has(normalizeOrigin(origin)) && !isFirefoxExtensionOrigin(origin)) {
      res.statusCode = 403;
      res.end("Forbidden origin");
      return;
    }
    // nosemgrep: javascript.express.security.cors-misconfiguration.cors-misconfiguration
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    next();
  };
}

// Firefox assigns a random UUID per profile to each unsigned extension
// install, so we can't pin the origin to a known value the way we do for
// Chrome (which uses a stable id derived from manifest.key). The actual
// access gate is the native host's allowed_extensions list -- only the
// packaged extension can start the managed server in the first place.
function isFirefoxExtensionOrigin(origin) {
  return typeof origin === "string" && origin.startsWith("moz-extension://");
}

function normalizeOrigin(origin) {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

function appendVary(existing, value) {
  const values = String(existing || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.includes(value)) {
    values.push(value);
  }
  return values.join(", ");
}

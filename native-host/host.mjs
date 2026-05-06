#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const serverPath = path.join(rootDir, 'src', 'server.mjs');
const logPath = path.join(rootDir, 'downloads', 'native-host.log');
const defaultPort = Number(process.env.XAD_PORT || 4512);
const startTimeoutMs = Number(process.env.XAD_NATIVE_START_TIMEOUT_MS || 15000);
const idleTimeoutMs = Number(process.env.XAD_NATIVE_IDLE_MS || 180000);
const serverIdleMs = Number(process.env.XAD_SERVER_IDLE_MS || 120000);

let child = null;
let childStartedByHost = false;
let protocolClosed = false;
let inputBuffer = Buffer.alloc(0);
let idleTimer = null;
let logFile = null;

await mkdir(path.dirname(logPath), { recursive: true });
logFile = await open(logPath, 'a');
log(`host started pid=${process.pid}`);
armIdleTimer();

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  readMessages().catch((error) => {
    log(`read error: ${error.stack || error.message}`);
    cleanupAndExit(1);
  });
});

process.stdin.on('end', () => {
  log('stdin closed');
  cleanupAndExit(0);
});

process.on('SIGTERM', () => cleanupAndExit(0));
process.on('SIGINT', () => cleanupAndExit(0));

async function handleMessage(message) {
  armIdleTimer();
  const id = message.id ?? null;

  try {
    if (message.type === 'ensureStarted' || message.type === 'start') {
      const origin = await ensureStarted(message);
      send({ id, ok: true, origin, pid: child?.pid ?? null, startedByHost: childStartedByHost });
      return;
    }

    if (message.type === 'ping' || message.type === 'status') {
      const origin = originFromMessage(message);
      const health = await readHealth(origin).catch(() => null);
      send({ id, ok: true, origin, server: health, pid: child?.pid ?? null, startedByHost: childStartedByHost });
      return;
    }

    if (message.type === 'stop') {
      await stopManagedServer();
      send({ id, ok: true, stopped: true });
      return;
    }

    throw new Error(`Unknown message type: ${message.type}`);
  } catch (error) {
    send({ id, ok: false, error: error.message });
  }
}

async function ensureStarted(message = {}) {
  const origin = originFromMessage(message);
  const existing = await readHealth(origin).catch(() => null);
  if (existing?.app === 'x-article-downloader') {
    return origin;
  }

  if (!child || child.exitCode !== null) {
    startServer(message);
  }

  await waitForHealth(origin, startTimeoutMs);
  return origin;
}

function startServer(message = {}) {
  const port = Number(message.port || defaultPort);
  child = spawn(process.execPath, [serverPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      XAD_MANAGED: '1',
      XAD_PORT: String(port),
      XAD_SERVER_IDLE_MS: String(serverIdleMs)
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  childStartedByHost = true;
  log(`server spawned pid=${child.pid} port=${port}`);

  child.stdout.on('data', (chunk) => log(`server stdout: ${chunk.toString().trim()}`));
  child.stderr.on('data', (chunk) => log(`server stderr: ${chunk.toString().trim()}`));
  child.on('exit', (code, signal) => {
    log(`server exited code=${code} signal=${signal}`);
    child = null;
    childStartedByHost = false;
  });
}

async function stopManagedServer() {
  if (!child || !childStartedByHost) {
    return;
  }

  const exiting = onceExit(child);
  child.kill('SIGTERM');
  await Promise.race([
    exiting,
    sleep(2500).then(() => {
      if (child) {
        child.kill('SIGKILL');
      }
    })
  ]);
}

function originFromMessage(message = {}) {
  if (message.origin) {
    return String(message.origin).replace(/\/$/, '');
  }

  const port = Number(message.port || defaultPort);
  return `http://127.0.0.1:${port}`;
}

async function readMessages() {
  while (inputBuffer.length >= 4) {
    const length = inputBuffer.readUInt32LE(0);
    if (inputBuffer.length < length + 4) {
      return;
    }

    const raw = inputBuffer.subarray(4, 4 + length).toString('utf8');
    inputBuffer = inputBuffer.subarray(4 + length);
    await handleMessage(JSON.parse(raw));
  }
}

function send(message) {
  if (protocolClosed) {
    return;
  }

  const json = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

async function readHealth(origin) {
  const response = await httpJson(`${origin}/health`);
  if (!response.ok || response.app !== 'x-article-downloader') {
    throw new Error('Unexpected /health response');
  }

  return response;
}

async function waitForHealth(origin, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      return await readHealth(origin);
    } catch (error) {
      lastError = error;
      await sleep(250);
    }
  }

  throw new Error(`Server did not become ready at ${origin}: ${lastError?.message || 'timeout'}`);
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: 2000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('HTTP timeout'));
    });
    request.on('error', reject);
  });
}

function armIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    log(`idle timeout after ${idleTimeoutMs}ms`);
    cleanupAndExit(0, { stopServer: false });
  }, idleTimeoutMs);
}

async function cleanupAndExit(code, options = {}) {
  if (protocolClosed) {
    return;
  }

  protocolClosed = true;
  clearTimeout(idleTimer);
  if (options.stopServer !== false) {
    await stopManagedServer().catch((error) => log(`cleanup error: ${error.message}`));
  }
  log('host exiting');
  await logFile?.close().catch(() => {});
  process.exit(code);
}

function onceExit(processHandle) {
  return new Promise((resolve) => {
    processHandle.once('exit', resolve);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  logFile?.write(line).catch(() => {});
}

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hostPath = path.join(rootDir, 'native-host', 'host.mjs');

test('native host starts and stops the managed server', async () => {
  const port = await getFreePort();
  const host = spawn(process.execPath, [hostPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      XAD_PORT: String(port),
      XAD_NATIVE_IDLE_MS: '30000'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  try {
    const start = await request(host, { type: 'ensureStarted', origin: `http://127.0.0.1:${port}`, port });
    assert.equal(start.ok, true);
    assert.equal(start.startedByHost, true);

    const health = await httpJson(`http://127.0.0.1:${port}/health`);
    assert.equal(health.ok, true);
    assert.equal(health.app, 'x-article-downloader');
    assert.equal(health.managed, true);

    const stop = await request(host, { type: 'stop' });
    assert.equal(stop.ok, true);
    await eventuallyRejects(() => httpJson(`http://127.0.0.1:${port}/health`));
  } finally {
    host.stdin.end();
    await Promise.race([
      once(host, 'exit'),
      sleep(2500).then(() => host.kill('SIGKILL'))
    ]);
  }
});

test('managed server shuts down after HTTP idle time', async () => {
  const port = await getFreePort();
  const host = spawn(process.execPath, [hostPath], {
    cwd: rootDir,
    env: {
      ...process.env,
      XAD_PORT: String(port),
      XAD_SERVER_IDLE_MS: '350',
      XAD_NATIVE_IDLE_MS: '30000'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  try {
    const start = await request(host, { type: 'ensureStarted', origin: `http://127.0.0.1:${port}`, port });
    assert.equal(start.ok, true);

    const health = await httpJson(`http://127.0.0.1:${port}/health`);
    assert.equal(health.app, 'x-article-downloader');

    await sleep(1000);
    await assert.rejects(() => httpJson(`http://127.0.0.1:${port}/health`));
  } finally {
    host.stdin.end();
    await Promise.race([
      once(host, 'exit'),
      sleep(2500).then(() => host.kill('SIGKILL'))
    ]);
  }
});

function request(host, message) {
  return new Promise((resolve, reject) => {
    const id = `${Date.now()}-${Math.random()}`;
    const timer = setTimeout(() => reject(new Error('native host response timeout')), 20000);
    let buffer = Buffer.alloc(0);

    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) {
        return;
      }

      const length = buffer.readUInt32LE(0);
      if (buffer.length < length + 4) {
        return;
      }

      const response = JSON.parse(buffer.subarray(4, 4 + length).toString('utf8'));
      if (response.id !== id) {
        return;
      }

      clearTimeout(timer);
      host.stdout.off('data', onData);
      resolve(response);
    };

    host.stdout.on('data', onData);
    writeNativeMessage(host.stdin, { ...message, id });
  });
}

function writeNativeMessage(stream, message) {
  const body = Buffer.from(JSON.stringify(message), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  stream.write(Buffer.concat([header, body]));
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 1200 }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on('error', reject);
  });
}

async function eventuallyRejects(fn) {
  const deadline = Date.now() + 5000;
  let lastResult;
  while (Date.now() < deadline) {
    try {
      lastResult = await fn();
    } catch {
      return;
    }
    await sleep(150);
  }

  throw new Error(`Expected request to fail, but got ${JSON.stringify(lastResult)}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Zero-dependency static server for the built client.
 *
 * This exists because the Vite dev server was not reachable through the preview proxy.
 * A plain static server removes every variable that could cause that: no HMR websocket,
 * no dev middleware, no origin/host allowlist logic. It serves packages/client/dist and
 * nothing else.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, 'dist');
const PORT = Number(process.env.PORT ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    // Reject anything trying to escape the dist root.
    const filePath = resolve(join(ROOT, normalize(pathname)));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    let target = filePath;
    let s = await stat(target).catch(() => null);
    if (!s || s.isDirectory()) {
      target = join(ROOT, 'index.html');
      s = await stat(target).catch(() => null);
      if (!s) {
        res.writeHead(500, { 'Content-Type': 'text/plain' }).end('dist/index.html missing - run: npm run build:client');
        return;
      }
    }

    const body = await readFile(target);
    res.writeHead(200, {
      'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': body.byteLength,
      // Never cache during iteration, so a rebuild is visible on refresh.
      'Cache-Control': 'no-store, must-revalidate',
      // Deliberately NO X-Frame-Options / CSP: this must embed in the preview iframe.
      'Access-Control-Allow-Origin': '*',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    console.log(`${req.method} ${pathname} -> 200 (${body.byteLength}b, ${Date.now() - started}ms)`);
  } catch (err) {
    console.error('request failed:', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(String(err));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`chaos-kitchen static server`);
  console.log(`  serving : ${ROOT}`);
  console.log(`  bound   : 0.0.0.0:${PORT}`);
  console.log(`  frames  : allowed (no X-Frame-Options / CSP set)`);
});

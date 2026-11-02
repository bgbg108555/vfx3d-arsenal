#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const portIdx = process.argv.indexOf('--port');
const PORT = (portIdx >= 0 && Number(process.argv[portIdx + 1])) || Number(process.env.PORT) || 8080;
const HOST = '127.0.0.1';

if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.log('[serve] dist/index.html not found — building web bundle...');
  const res = spawnSync(process.execPath, [path.join(ROOT, 'build.mjs'), '--web', 'dist'], { cwd: ROOT, stdio: 'inherit' });
  if (res.status !== 0) process.exit(res.status || 1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
};

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const relPath = decodeURIComponent(urlObj.pathname === '/' ? '/index.html' : urlObj.pathname);
  const safePath = path.resolve(DIST_DIR, '.' + relPath);
  if (!safePath.startsWith(DIST_DIR) || !fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  const ext = path.extname(safePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(safePath).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`VFX3D Arsenal preview server running at http://${HOST}:${PORT}/`);
});

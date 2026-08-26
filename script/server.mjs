import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'
};

const server = http.createServer((req,res) => {
  const requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (requestPath.startsWith('/api/')) {
    res.writeHead(404, {'content-type':'application/json'}); res.end(JSON.stringify({error:'API routes are provided by Vercel in production.'})); return;
  }
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
  const target = path.join(root, relative);
  if (!target.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.stat(target, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404, {'content-type':'text/plain'}); res.end('Not found'); return; }
    res.writeHead(200, {'content-type': mime[path.extname(target)] || 'application/octet-stream', 'cache-control':'no-store'});
    fs.createReadStream(target).pipe(res);
  });
});
server.listen(port, '0.0.0.0', () => console.log(`FlowLab preview: http://127.0.0.1:${port}/`));

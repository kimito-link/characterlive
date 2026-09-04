/**
 * serve-demo.mjs — demo.html を開くためだけの静的サーバ。
 *
 * ★なぜ要るか: demo.html は ES module を import する。file:// で開くと
 *   CORS で module がロードされず【真っ白な画面】になる(ページのせいに見える)。
 *   http:// で出せば済むので、依存を増やさず Node 標準だけで出す。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = url === '/' ? 'demo.html' : url.replace(/^\/+/, '');
  // ルート外へ出さない(..%2f 等の相対脱出を弾く)。
  const path = join(ROOT, normalize(rel));
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => {
  console.log(`characterlive demo → http://localhost:${PORT}/`);
});

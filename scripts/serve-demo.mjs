/**
 * serve-demo.mjs — このリポの静的サーバ。
 *
 * ★なぜ要るか: ページは ES module を import する。file:// で開くと
 *   CORS で module がロードされず【真っ白な画面】になる(ページのせいに見える)。
 *   http:// で出せば済むので、依存を増やさず Node 標準だけで出す。
 *
 * ★ルート(/) は index.html = LP（2026-09-04 変更）。
 *   以前は demo.html を返していたが、LPを作った後もそのままだったため
 *   「LPを開いたつもりがデモが出る」取り違えが実際に起きた。
 *   Web の標準どおり index.html を既定にする。開発用のデモは /demo.html で開く。
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
  // ★ルートは index.html(LP)。デモは /demo.html を明示して開く。
  const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
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

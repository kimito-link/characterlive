// セキュリティヘッダーを vercel.json に書き出す。index.html を編集したら `npm run headers` を実行する。
//
// ★なぜ生成するのか: トップページ(index.html)の CSP は script/style を「ハッシュ」で許可している。
//   index.html のインライン script/style を1文字でも変えるとハッシュが変わり、
//   CSP が古いままだと本番のページが白くなる(script が止まる)。
//   → vercel.json の CSP は index.html から必ず作り直す。ずれは src/headers.test.js が検出する。
// ★unsafe-inline / unsafe-eval は使わない(診断の「CSP が弱い」判定に当たるため)。
// ★talk.html(開発版・マイク・ログの別窓が document.write で作られる)は厳格 CSP の対象外。
//   別窓は親の CSP を引き継ぐので、ここへ厳格 CSP をかけると別窓が動かなくなる。
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { charaLiveStageCss } from '../src/lib/charaLiveStage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** HTML の中の「実行されるインライン script」と「インライン style」の中身を取り出す。 */
export function inlineBlocks(rawHtml) {
  // ★ブラウザは改行を LF にそろえてからハッシュを取る。Windows の CRLF のまま計算するとハッシュが合わず、
  //   実ブラウザで script/style が止まる(2026-10-06 に Chrome で実測して発覚)。
  const html = rawHtml.replace(/\r\n?/g, '\n');
  const scripts = [];
  const styles = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue; // 外部ファイルは 'self' で許可される
    if (/type\s*=\s*["']application\/(ld\+)?json["']/i.test(attrs)) continue; // データであって実行されない
    scripts.push(m[2]);
  }
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) styles.push(m[1]);
  return { scripts, styles };
}

/** トップページ用の CSP を index.html の中身から作る。 */
export function buildIndexCsp(html) {
  const { scripts, styles } = inlineBlocks(html);
  const parts = [
    "default-src 'self'",
    `script-src 'self' ${scripts.map(sha256).join(' ')}`.trim(),
    // 実行時に JS が <style> を作る(charaLiveController.js)。中身は固定の文字列なので、そのハッシュも許可する。
    `style-src 'self' ${[...styles, charaLiveStageCss()].map(sha256).join(' ')}`.trim(),
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ];
  return parts.join('; ');
}

/** 全ページに付ける、ページの中身に依存しないヘッダー。 */
export const COMMON_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // マイクは /talk の音声認識が使う。ほかは使わないので閉じる。
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), payment=()' },
];

/** このスクリプトが管理するルールか(vercel.json は未知のキーを嫌うので、印ではなく中身で判別する)。 */
const isManaged = (r) =>
  r.headers.some((h) => h.key === 'X-Content-Type-Options' || h.key === 'Content-Security-Policy');

export function applyHeaders(vercel, indexHtml) {
  const rules = (vercel.headers || []).filter((r) => !isManaged(r));
  const managed = [
    { source: '/(.*)', headers: COMMON_HEADERS },
    { source: '/', headers: [{ key: 'Content-Security-Policy', value: buildIndexCsp(indexHtml) }] },
  ];
  return { ...vercel, headers: [...rules, ...managed] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const vpath = join(ROOT, 'vercel.json');
  const raw = readFileSync(vpath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'; // 元の改行コードを保つ(差分を「足した設定」だけにする)
  const next = applyHeaders(JSON.parse(raw), readFileSync(join(ROOT, 'index.html'), 'utf8'));
  writeFileSync(vpath, (JSON.stringify(next, null, 2) + '\n').replace(/\n/g, eol));
  console.log('vercel.json を更新しました');
}

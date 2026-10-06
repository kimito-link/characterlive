import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyHeaders, buildIndexCsp, inlineBlocks } from '../scripts/gen-headers.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('セキュリティヘッダー(vercel.json)', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const index = read('index.html');

  it('vercel.json が index.html から生成した内容と一致している(index.html を直したら npm run headers)', () => {
    expect(vercel).toEqual(applyHeaders(vercel, index));
  });

  it('トップの CSP は script/style を unsafe-inline・unsafe-eval で許可しない', () => {
    const csp = buildIndexCsp(index);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(csp).toMatch(/script-src [^;]*'sha256-/);
  });

  it('index.html のインライン script は全部ハッシュ許可されている(許可漏れ=本番で白画面)', () => {
    const { scripts, styles } = inlineBlocks(index);
    expect(scripts.length).toBeGreaterThan(0);
    expect(buildIndexCsp(index).match(/'sha256-/g).length).toBe(scripts.length + styles.length + 1); // +1 = 実行時に JS が作る <style>
  });

  it('index.html に style 属性・on*属性が無い(CSP で許可していないため)', () => {
    expect(index).not.toMatch(/\sstyle\s*=/i);
    expect(index).not.toMatch(/\son[a-z]+\s*=\s*["']/i);
  });

  it('全ページに共通ヘッダー5種のうち CSP 以外の4つが付く', () => {
    const common = vercel.headers.find((r) => r.source === '/(.*)').headers.map((h) => h.key);
    expect(common).toEqual(['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']);
  });
});

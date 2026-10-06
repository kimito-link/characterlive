import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

/** .vercelignore の行(コメント・空行を除く) */
const rules = read('.vercelignore')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

/** 相対パス p が .vercelignore に当たるか(この repo で使っている書き方だけを解釈する簡易版) */
function ignored(p) {
  const s = p.replace(/\\/g, '/').replace(/^\.\//, '');
  return rules.some((r) => {
    if (r.endsWith('/')) return s === r.slice(0, -1) || s.startsWith(r);
    if (r === 'src/**/*.test.js') return s.startsWith('src/') && s.endsWith('.test.js');
    if (r.startsWith('*.')) return !s.includes('/') && s.endsWith(r.slice(1));
    return s === r;
  });
}

describe('.vercelignore(内部資料を本番に出さない)', () => {
  it('開発用の資料・スクリプト・設定・テストを外している', () => {
    for (const p of ['_docs/NEXT-SESSION.md', 'scripts/serve-demo.mjs', 'DEPLOY.md', 'ROADMAP.md', 'vitest.config.js', 'src/lib/x.test.js']) {
      expect(ignored(p), `${p} は配信しない`).toBe(true);
    }
  });

  it('サイトの表示に要るものは外していない', () => {
    for (const p of ['index.html', 'talk.html', 'overlay.html', 'demo.html', 'src/index.js', 'src/lib/charaCloudRequest.js', 'api/chat.js', 'assets/x.png', 'vercel.json', 'robots.txt']) {
      expect(ignored(p), `${p} は配信する`).toBe(false);
    }
  });

  it('各ページが読み込むローカルのファイルを、1つも外していない(外すと本番で白画面)', () => {
    for (const page of ['index.html', 'talk.html', 'demo.html', 'overlay.html']) {
      const html = read(page);
      const refs = [...html.matchAll(/(?:src|href)="([^"#?:]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('//'));
      for (const r of refs) {
        const p = r.replace(/^\//, '');
        if (!existsSync(join(ROOT, p))) continue; // /talk のようなルート(cleanUrls)は対象外
        expect(ignored(p), `${page} が参照する ${p}`).toBe(false);
      }
    }
  });

  it('api と src/lib が import するファイルを外していない', () => {
    const files = ['api/chat.js'];
    for (const f of files) {
      for (const m of read(f).matchAll(/from\s+'(\.[^']+)'/g)) {
        const p = normalize(join(dirname(f), m[1])).replace(/\\/g, '/');
        expect(ignored(p), `${f} が import する ${p}`).toBe(false);
      }
    }
  });
});

/**
 * build-ogp.mjs — OGP（SNSでリンクを貼ったとき出るカード）用の画像を作る。
 *
 * ★なぜ要るか（2026-09-04）
 *   それまでの OGP は
 *     - `og:image` が **相対パス**（多くのSNSで画像が出ない）
 *     - 画像が **正方形のキャラ顔**（summary_large_image は横長が要る）
 *   という状態で、実質機能していなかった。
 *
 * ★このスクリプトは Python(Pillow) を呼ぶだけの薄いラッパ。
 *   画像合成そのものは scripts/build-ogp.py が持つ（Node に画像ライブラリを足さないため。
 *   sharp を入れるとネイティブビルドが要り、環境差で壊れる）。
 *
 * 使い方:
 *   npm run ogp
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const py = join(here, 'build-ogp.py');

// ★Windows は `python`、他は `python3` が一般的。両方試す（環境差で落ちないように）。
const candidates = ['python', 'python3'];
let ran = false;

for (const cmd of candidates) {
  const r = spawnSync(cmd, [py], { stdio: 'inherit' });
  if (r.error && r.error.code === 'ENOENT') continue; // そのコマンドが無いだけ→次を試す
  ran = true;
  process.exit(r.status ?? 1);
}

if (!ran) {
  console.error('✗ python が見つかりません。Pillow 入りの Python が必要です。');
  console.error('  確認: python -c "import PIL; print(PIL.__version__)"');
  process.exit(1);
}

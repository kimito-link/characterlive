# -*- coding: utf-8 -*-
"""
build-icons.py — ファビコン一式を作る（2026年の最小構成）。

★調査で確認した事実（一次資料ベース）

1. **Google は SVG ファビコンに非対応**（Google Search Central 公式）。
   対応形式は BMP/GIF/ICO/PNG/JPEG/PPM/TIFF。**48x48 より大きいものを推奨**。
   → SVG だけ置くと Google には何も無いのと同じ。**PNG を必ず用意する。**

2. **apple-touch-icon は 180x180・透過なし**。
   透過があると iOS が**黒背景で合成**して汚くなる。→ 背景を塗りつぶす。

3. **もう要らないもの**（入れると害になる/無意味）:
   - `mask-icon`  … Safari 12 以降は死んでいる。**本物のファビコンを上書きすることがある**
   - `msapplication-*` / `browserconfig.xml` … 旧Edge/Windowsタイル。死んでいる
   - `rel="shortcut icon"` … MDN が「使ってはならない」と明記
   - 2015年頃の20ファイル並べる作法 … 不要

出力:
  favicon.ico          32x32(+16x16)
  favicon-96x96.png    96x96   ← Googleが読む本命
  apple-touch-icon.png 180x180 透過なし
  icon-192.png / icon-512.png  … Android ホーム画面（manifest 用）
"""
import os
import sys
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "brand", "logo_kimito-link_RGB_favi_blue.png")
BG = (255, 250, 244)  # LPの地の色。透過を潰すときに使う


def flatten(im, size):
    """透過を背景色で潰して正方形にする（iOS が黒で合成するのを防ぐ）。"""
    im = im.convert("RGBA").resize((size, size), Image.LANCZOS)
    canvas = Image.new("RGB", (size, size), BG)
    canvas.paste(im, (0, 0), im)
    return canvas


def main():
    if not os.path.exists(SRC):
        raise SystemExit(f"✗ 元画像が無い: {SRC}")
    src = Image.open(SRC).convert("RGBA")
    made = []

    # favicon.ico … 32/16 を1ファイルに（ブラウザのタブ用）
    ico = os.path.join(ROOT, "favicon.ico")
    src.resize((64, 64), Image.LANCZOS).save(
        ico, format="ICO", sizes=[(32, 32), (16, 16)]
    )
    made.append(("favicon.ico", ico))

    # ★Google が読む本命。48x48 より大きいこと
    p96 = os.path.join(ROOT, "favicon-96x96.png")
    src.resize((96, 96), Image.LANCZOS).save(p96, "PNG", optimize=True)
    made.append(("favicon-96x96.png", p96))

    # ★iOS ホーム画面。透過なし必須
    apple = os.path.join(ROOT, "apple-touch-icon.png")
    flatten(src, 180).save(apple, "PNG", optimize=True)
    made.append(("apple-touch-icon.png", apple))

    # Android ホーム画面（manifest から参照）
    for size in (192, 512):
        p = os.path.join(ROOT, f"icon-{size}.png")
        flatten(src, size).save(p, "PNG", optimize=True)
        made.append((f"icon-{size}.png", p))

    for name, path in made:
        kb = os.path.getsize(path) / 1024
        print(f"✓ {name}  {kb:.0f}KB")


if __name__ == "__main__":
    main()

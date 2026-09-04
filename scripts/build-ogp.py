# -*- coding: utf-8 -*-
"""
build-ogp.py — SNSでリンクを貼ったとき出るカード画像を作る。

★設計の根拠（2026-09-04 調査・すべて一次資料で確認）

1. **サイズは 1200x630 の1枚だけ**（PNG・300KB未満）
   Facebook公式が 1200x630 推奨。X も og: にフォールバックするので1枚で足りる。
   WhatsApp は 600KB上限だが、モバイル回線での失敗報告があるため 300KB を目標にする。

2. ★**中央 630x630 に全要素を収める（最重要）**
   LINE は **og:title / og:description / og:image の3つしか読まない**（LINE公式FAQ）。
   そして **正方形にクロップされることがある**（仕様は非公開・クライアントで挙動が違う）。
   日本の配信者が対象なのでLINEを外せない。
   → **両端が切られても成立する構図**にする。ロゴも文字もキャラも中央に置く。
   → LINE用に別画像を出すことはできない（同じ og:image を読むため）。

3. **PNG を使う。WebP は使わない**
   X は公式には WebP 対応だが、Facebook が読めないことが多く LinkedIn は無視する。

4. 2倍解像度で描いてから縮小する（文字の輪郭を滑らかにするため）。

出力:
  assets/og/og-card.png   1200x630
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

# Windows のコンソールでも日本語を出せるようにする
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "assets", "og")

W, H = 1200, 630
S = 2  # 描画倍率（2倍で描いて縮小＝アンチエイリアス）

# LP と同じ配色（ロゴの紺・オレンジに合わせた明るい地）
NAVY_DEEP = (20, 55, 92)
NAVY = (28, 75, 125)
ORANGE = (200, 114, 28)
BG = (255, 250, 244)
BG2 = (255, 243, 230)
MUTED = (95, 83, 70)

FONT_CANDIDATES = [
    ("C:/Windows/Fonts/YuGothB.ttc", 0),
    ("C:/Windows/Fonts/BIZ-UDGothicB.ttc", 0),
    ("C:/Windows/Fonts/meiryob.ttc", 0),
    ("C:/Windows/Fonts/NotoSansJP-VF.ttf", 0),
]


def font(size):
    """日本語が確実に描けるフォントを返す。無ければ即座に失敗させる（豆腐を出さない）。"""
    for path, idx in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=idx)
            except Exception:
                continue
    raise SystemExit("✗ 日本語フォントが見つかりません。文字化けした画像を出すより止めます。")


def load_face(dir_name, prefix, eyes, mouth):
    """キャラの顔を ベース+目+口 で合成する（LPと同じパーツ方式）。"""
    base_dir = os.path.join(ROOT, "assets", "characters", dir_name)
    face = Image.open(os.path.join(base_dir, f"{prefix}-face-base.png")).convert("RGBA")
    for part in (f"{prefix}-eyes-{eyes}.png", f"{prefix}-mouth-{mouth}.png"):
        p = os.path.join(base_dir, part)
        if os.path.exists(p):
            face.alpha_composite(Image.open(p).convert("RGBA"))
    return face


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    cw, ch = W * S, H * S
    img = Image.new("RGB", (cw, ch), BG)
    d = ImageDraw.Draw(img)

    # ---- 背景: 上からほんのり暖色（LPのヒーローと同じ雰囲気） ----
    for y in range(ch):
        t = max(0.0, 1.0 - y / (ch * 0.75))
        d.line(
            [(0, y), (cw, y)],
            fill=(
                int(BG[0] + (BG2[0] - BG[0]) * t),
                int(BG[1] + (BG2[1] - BG[1]) * t),
                int(BG[2] + (BG2[2] - BG[2]) * t),
            ),
        )

    # ★安全域: LINE が正方形に切ることがあるので、中央 630x630 に収める
    safe_w = 630 * S
    safe_x0 = (cw - safe_w) // 2

    # ---- ロゴ（上部・中央）----
    logo_path = os.path.join(ROOT, "assets", "brand", "logo_kimito-link_RGB_maru_ginga.png")
    logo = Image.open(logo_path).convert("RGBA")
    logo_w = int(230 * S)
    logo_h = int(logo.height * (logo_w / logo.width))
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    img.paste(logo, ((cw - logo_w) // 2, int(30 * S)), logo)

    # ---- 見出し（2行・中央）----
    f_main = font(int(58 * S))
    # ★コピー（2026-09-04 会議で決定）
    #   「孤独」を言葉にしない。調査で、孤独を前面に出した製品だけが停止していた
    #   （AI視聴者ジェネレーター）。配信者は「人が来ないのは仕組みが無いだけで
    #   あなたのせいではない」と言われたい。「寂しい」と書くと"あなたの問題"になる。
    #   さらに孤独訴求は【成長すると対象外になる】（200人に育つと当てはまらない）。
    #   → 娯楽（盛り上げ）を主役にする。0人でも大勢でも成立する。
    lines = ["ゆっくり3人組が、", "配信を盛り上げます。"]
    y = int(196 * S)
    for i, line in enumerate(lines):
        color = ORANGE if i == 1 else NAVY_DEEP
        bbox = d.textbbox((0, 0), line, font=f_main)
        d.text(((cw - (bbox[2] - bbox[0])) // 2, y), line, font=f_main, fill=color)
        y += int(78 * S)

    # ---- 説明（1行・中央）----
    f_sub = font(int(26 * S))
    # ★「置き換えではない」税を必ず払う。市場首位の ai_licia もヒーローコピーで
    #   "She's not here to replace you" と明言している。嫌われるのは「相方」では
    #   なく【置き換え】。AIが配信者の出番を奪うか増やすかが分かれ目だった。
    sub = "あなたの代わりではなく、あなたと一緒に。"
    bbox = d.textbbox((0, 0), sub, font=f_sub)
    d.text(((cw - (bbox[2] - bbox[0])) // 2, y + int(8 * S)), sub, font=f_sub, fill=MUTED)

    # ---- 3人の顔（下部・中央に寄せる＝LINEで切られない）----
    faces = [
        load_face("link", "link-yukkuri", "smile", "closed"),
        load_face("konta", "kitsune-yukkuri", "smile", "open"),
        load_face("tanunee", "tanuki-yukkuri", "half", "closed"),
    ]
    fw = int(132 * S)
    gap = int(22 * S)
    total = fw * 3 + gap * 2
    # ★安全域からはみ出さないことを保証する
    assert total <= safe_w, f"3人の幅 {total} が安全域 {safe_w} を超えている"
    fx = (cw - total) // 2
    fy = int(410 * S)
    for face in faces:
        face = face.resize((fw, fw), Image.LANCZOS)
        img.paste(face, (fx, fy), face)
        fx += fw + gap

    # ---- ドメイン（最下部）----
    f_dom = font(int(23 * S))
    dom = "characterlive.link"
    bbox = d.textbbox((0, 0), dom, font=f_dom)
    d.text(((cw - (bbox[2] - bbox[0])) // 2, int(578 * S)), dom, font=f_dom, fill=NAVY)

    # ---- 書き出し（2倍→等倍に縮小）----
    out = img.resize((W, H), Image.LANCZOS)
    path = os.path.join(OUT_DIR, "og-card.png")
    out.save(path, "PNG", optimize=True)

    kb = os.path.getsize(path) / 1024
    print(f"✓ {os.path.relpath(path, ROOT)}  {W}x{H}  {kb:.0f}KB")
    if kb > 300:
        # ★300KB超はモバイル回線での失敗報告がある。減色して詰める。
        out.convert("P", palette=Image.ADAPTIVE, colors=256).save(path, "PNG", optimize=True)
        kb = os.path.getsize(path) / 1024
        print(f"  → 減色して {kb:.0f}KB")
    if kb > 300:
        print(f"  ⚠ まだ {kb:.0f}KB。300KB以下が望ましい。")


if __name__ == "__main__":
    main()

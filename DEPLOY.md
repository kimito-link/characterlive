# 公開のしかた（characterlive.link）

## 構成

- **ビルドしない静的サイト**。LPは `index.html` 1枚 + `src/` の ES module を直接読む。
- 追憶のきらめき（tsuioku-no-kirameki.com）と同じ流儀。

## vercel.json の各設定の理由

★`vercel.json` は **JSONにコメントを書けない**（`//` を入れると
`Invalid vercel.json - should NOT have additional property` で**デプロイが落ちる**）。
実際に一度落ちたので、理由はここに残す。

| 設定 | なぜ |
|---|---|
| `buildCommand: null` / `installCommand: null` | ビルド不要。素のHTML/JSをそのまま配る |
| `outputDirectory: "."` | リポ直下がそのまま公開ディレクトリ |
| `cleanUrls: true` | `/demo` で `/demo.html` が開ける |
| `/src/(.*).js` に `Content-Type: text/javascript` | ★MIMEが違うとブラウザがESモジュールの実行を拒否し、**画面が真っ白になる**（LPはsrc/を直接importしている） |
| `/assets/(.*)` を1日キャッシュ | キャラ画像は差し替え頻度が低い。再取得のちらつきも防ぐ |
| `/` は毎回再検証 | LPの文言を直したらすぐ反映させたい |

## 公開する

```bash
npx vercel --prod
```

GitHub（kimito-link/characterlive）と連携済みなので、push でも反映される。

## ルーティング

- `/` → `index.html`（LP）
- `/demo.html` → 開発用デモ（3人を手動で動かせる。LPには載せない）

ローカルで見るときは `npm run demo` → http://localhost:5173/
（★ルートはLP。デモは /demo.html）

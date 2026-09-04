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

## ドメインを繋ぐ（characterlive.link）

★**リポ直下から実行する**。相対パスを間違えると `MODULE_NOT_FOUND` になる（実際に踏んだ）。

```bash
npm run domain          # A/CNAME を設定
npm run domain:check    # 今の状態を見るだけ
```

実体は `../ai-hub/bin/domain-connect.mjs`（横断ツール。正本は ai-hub 側）。
★npm script にしてあるので、パスを手で打たなくてよい。

### 1回だけ必要なもの
環境変数 `CLOUDFLARE_DNS_TOKEN`。
Cloudflare → マイプロフィール → APIトークン → テンプレート「**ゾーンDNSを編集する**」
→ ゾーンリソース「すべてのゾーン」。

★既存の `CLOUDFLARE_API_TOKEN` では**動かない**（ゾーン一覧は見えるが DNS 操作が
`10000: Authentication error` で弾かれる。実測）。

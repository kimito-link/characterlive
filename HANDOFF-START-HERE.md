# characterlive — 最初に読む（新セッション用の引き継ぎ）

> ★このリポは **2026-09-04 に空の状態から始まる**。
> ★ここに書いてあるのは**すべて実ファイルで確認済みの事実**。推測は「未確認」と明記してある。
> 前セッション（追憶のきらめきの作業中）で、ユーザーが参照8件を提示して固まった構想。

---

## 0. ★まずこれだけ知ればいい（3行）

1. 作るのは **3人（りんく・こん太・たぬ姉）がふわふわ浮いて喋る部品**。それだけ。
2. ★**素材とコードは既にある**（追憶のきらめきに）。ゼロから作らない。移植する。
3. ★会話AIは**このリポの範囲外**（別途）。まずは「動く3人」を独立させることだけ。
   ★（2026-09-07 追記）その後、会話AIもこのリポに入った。現状と設計の正本は `_docs/` にある:
   `_docs/NEXT-SESSION.md`（今どこか）／`_docs/CONVERSATION-DESIGN.md`（会話設計の正本）／
   `_docs/RESEARCH-companion-voice-2026-09-07.md`（調査の根拠・採用5禁止5）／`_docs/RESEARCH-LEDGER.md`（日課の台帳）

---

## 1. ★何を作るのか（スコープ）

★ユーザーの言葉（原文）:
> この3人が**ふわふわするものだけ別でつくる**

★つまり **見た目と動きだけ**。中身（何を喋るか）は含めない。

| 入れる | 入れない |
|---|---|
| 3人が並んで浮いている | ★会話AI・APIキー |
| 表情が変わる（目・口） | ★配信サイトとの連携 |
| 口パク・まばたき | ★コメント取得 |
| 吹き出しで喋る | ★声（VOICEVOX）※ただし将来つなげる前提 |
| ★いろんなアクション | |

---

## 2. ★なぜ作るのか（この背景を消さないこと）

★芯の一文（ユーザーが提示した勇者トロAIの配信より）:
> **ただ一人で抱え込まないように そばにいることしかできない**

★用途:
> 配信者が **まだかけだしのとき / だれもいないときに**
> 1人で配信しても **間を持たせてくれたり**
> 3人と **適度に会話できたり**

★詳しい構想（参照作品8件・なぜこの形なのか）は追憶側にある:
`tsuioku-no-kirameki.com/_docs/CONCEPT-aibou-3nin-2026-09-04.md`
★**設計に迷ったらこれを読む**。ここには要約しか書いていない。

---

## 3. ★移植元（すべて実在を確認済み）

移植元リポ: `C:\Users\info\OneDrive\デスクトップ\Resilio\github\tsuioku-no-kirameki.com`

### コード（4ファイル・計1,453行）
| ファイル | 行数 | 役割 |
|---|---|---|
| `src/lib/charaLiveController.js` | 316 | ★入口。`startCharaLive(deps)` を export |
| `src/lib/charaLiveStage.js` | 362 | DOM生成 + CSS |
| `src/lib/charaLiveState.js` | 625 | 状態機械（表情・口パクの決定） |
| `src/lib/charaLiveCensus.js` | 150 | 計器（観測のみ） |

テストも既にある（移植すること）:
`charaLiveController.test.js`(316) / `charaLiveState.test.js`(359) / `charaLiveCensus.test.js`(108)

### ★外部依存はたった1つ
`charaLiveStage.js:23` と `charaLiveState.js:29` が
`yukkuriBroadcastSummary.js` の `yukkuriCharacterImagePath` を import している。

★中身は**7行だけ**なので、移植先に小さな純関数として持っていけばよい:
```js
export function yukkuriCharacterImagePath(character, expression, mouthOpen) {
  const base = CHAR_BASE[character];
  if (character === 'konta' && expression === 'normal') {
    return `${base}-normal.png`;   // ★konta だけ normal 単独ファイルを持つ
  }
  return `${base}-${expression}-mouth-${mouthOpen ? 'open' : 'closed'}.png`;
}
```
★`CHAR_BASE` は `yukkuriBroadcastSummary.js` の上部にある（要確認・行30付近）。
実ファイル名から逆算すると: link→`link-yukkuri` / konta→`kitsune-yukkuri` / tanu→`tanuki-yukkuri`

### ★素材（★正本は kimito-link。追憶のはコピー）

★**3人は自社キャラクター**（kimito-link.com）。素材は**同じものが3箇所にある**:

| 場所 | 性質 |
|---|---|
| ★`github/kimito-link/src/images/yukkuri-character-parts/` | ★**パーツの正本**（顔ベース+目4+口2 × 3キャラ = 21枚） |
| `github/kimito-link/src/images/yukkuri-charactore-english/` | 合成済み（26枚） |
| `kimito-link.com/free-assets/` | 上記の配布用ページ（外部向け） |
| `tsuioku-no-kirameki.com/extension/images/` | ★追憶へ**コピー**されたもの（合成済みのみ） |

★**characterlive はどれを見るか決めること**（「正本1つ・コピーを散らさない」）。
　推奨: `kimito-link/src/images/yukkuri-character-parts/` を正本とし、
　characterlive へはビルド時にコピーするか、リポに1回だけ取り込む。

### ★★パーツ方式で作る（合成済みではなく）

★`kimito-link.com/free-assets/` に**仕様が明記されている**（自社で決めた仕様）:
> すべて **1500×1500px・同じ位置でぴったり重なる透過PNG**です。
> 「顔ベース」の上に「目」と「口」のパーツを重ねるだけで、
> ★**まばたきや口パクのアニメーションが作れます**

★パーツ構成（3キャラ共通・各7枚）:
```
face-base     顔の土台
eyes-normal / eyes-half / eyes-blink / eyes-smile   ← 目4種
mouth-closed / mouth-open                            ← 口2種
```

★**なぜ合成済み(26枚)ではなくパーツ(21枚)を使うか**:

| 合成済み | ★パーツ |
|---|---|
| 表情4×口2 = 8通りで固定 | ★目と口が**独立して動く** |
| ★口パク中にまばたきできない | ★**喋りながらまばたきできる** |
| 表情を足すには絵が要る | 重ね方を変えるだけ |

★「**いろんなアクションもほしい**」というユーザーの要望に直結する。
★座標合わせも不要（同じ位置でぴったり重なる仕様）。

★**ただし移植元の追憶は合成済み前提**（`yukkuriCharacterImagePath` が1枚のパスを返す）。
　⟹ ★`charaLiveState.js` の**状態機械はそのまま使える**が、
　　出力を「1枚のパス」から「**3枚のパス（土台/目/口）**」に変える必要がある。
　　★ここがこのリポで最初に設計し直す唯一の箇所。

### ★キャラの設定は公開ページが正本
`kimito-link.com/characters/` に本人の言葉で書かれている（★会話を作るとき使う）:

| キャラ | 口調 | 設定 |
|---|---|---|
| りんく | 「〜なのだ」「はろー」 | 明るく元気・声のお手伝い担当・カップヌードルはカレー/シーフード |
| こん太 | 「ボク」「〜だよ」 | 元気いっぱい・サッカー好き・どん兵衛きつね派 |
| たぬ姉 | 「〜わ」「〜のよ」 | 世話焼きの姉・弟のフォロー・どん兵衛たぬき派 |

★各自の X アカウントも実在: @yukkurilink / @yukkurikonta / @yukkuritanunee

---

## 4. ★既にあるもの（作り直さない）

★`startCharaLive(deps)` が返すAPI（`charaLiveController.js:79-88`）:
```
root, preloadedImages, setVisible,
onCommentSpoken, onCommentSpokenEnd,
onStreamerAddressed,      ← ★配信者が話しかける（受け口だけあって未使用）
beginThinking, endThinking, ← ★考え中の表現（同上）
destroy
```
★**会話の受け口は既に実装済みで、追憶では誰も呼んでいない**（grep 0件）。
　このリポで初めて使うことになる。

★依存注入で受ける形になっている（＝追憶の外でそのまま動く）:
```js
startCharaLive({ doc, mount, resolveUrl, getHeatLevel, reducedMotion })
```

★アニメーション（`charaLiveStage.js`）:
- `nlcl-pop` … 出現（160ms）
- `nlcl-think` … 考え中の3点リーダー（1.25s）
- ★`transform-origin: 50% 90%` — 「浮遊しても『立っている』感じが崩れない」
- `prefers-reduced-motion` 対応済み（`:233-234`）

---

## 5. ★踏んではいけない罠（移植元のコメントに書いてある）

1. ★**transform は1本にまとめて書く**（`charaLiveStage.js:18`）
   translate/rotate/scale を別々に当てると**上書き事故**になる。
2. ★**mount 先に注意**（`venueBar.js:3160-3162`）
   追憶では body 直下に置いたら全画面要素に覆われて**一度も見えなかった**実績がある。
3. ★**hidden 属性は display:flex に負ける**（`charaLiveStage.js:221-223`）
   だから `.nlcl-stage[hidden] { display: none; }` を明示している。消さないこと。

---

## 6. ★最初の1歩（提案・未着手）

```
1. git init + GitHub の kimito-link/characterlive に繋ぐ
   （リモートは作成済み: https://github.com/kimito-link/characterlive.git）
2. 4ファイル + テスト3本を移植（yukkuriCharacterImagePath は小さく作り直す）
3. ★パーツ画像21枚を取り込む（`kimito-link/src/images/yukkuri-character-parts/`）
4. ★demo.html を1枚作る = 開くと3人がふわふわしているだけのページ
   → ★これが「動いた」の最初の証拠になる
5. その後にアクションを足していく
```

★**4までを1回目のゴールにする**のを勧める。
　「3人が浮いている HTML が1枚ある」状態まで行けば、あとは足すだけになる。

---

## 7. ★未確定（次のセッションで決めること）

- ★**声（VOICEVOX）をこのリポに入れるか** … 追憶に `voicevoxClient.js` がある。
  ただし「ふわふわするものだけ」というスコープからは外れる可能性
- ★**アクションを何種類作るか** … ユーザーの言葉は「**いろんなアクションもほしい**」。
  参照は YMM4（ゆっくりムービーメーカー）の場面切り替え。
  候補: 入退場・喋る番のキャラが前に出る・頷く・跳ねる・のけぞる・顔を見合わせる
- ★**素材をどう持つか** … 正本は `kimito-link/src/images/yukkuri-character-parts/`。
  characterlive へ**コピーして持つ**か、**参照する**かを決める（コピーを散らさない原則）
- ★**追憶との関係** … 追憶側も将来この部品を使う（逆輸入）のか、別々に持つのか

---

## 8. ★このリポは2回目である（重要）

★`github/characterlive/` は **2026-08-25 に作られて、中身が空のまま放置されていた**。
　＝ 過去に同じ構想で名前だけ作って止まっている。

★今回動かすなら、**まず demo.html が1枚動くところまで**を最短で通すこと。
　構想を練るより、**3人が画面で浮いている状態**を先に作るほうが続く。

---

作成: 2026-09-04 / 追憶のきらめきのセッションから引き継ぎ

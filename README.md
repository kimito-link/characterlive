# characterlive

**りんく・こん太・たぬ姉の3人が、ふわふわ浮いて喋る部品。**

見た目と動きだけ。何を喋るか（会話AI）と声は入っていない — ただし受け口は開いている。

---

## まず動かす

```bash
npm install
npm run demo
```

→ http://localhost:5173/ を開くと、3人が浮いている。

> `demo.html` を file:// で直接開くと **真っ白になる**（ES module が CORS で読めない）。
> 必ず `npm run demo` 経由で開くこと。

---

## 使う

```js
import { startCharaLive } from './src/index.js';

const live = startCharaLive({
  doc: document,
  mount: document.getElementById('stage'), // ★body 直下に置かないこと（後述）
  resolveUrl: (p) => p                     // 拡張なら chrome.runtime.getURL
});
```

`startCharaLive` が返すもの:

| API | 何をするか |
|---|---|
| `setVisible(bool)` | 表示/非表示。false の間は描画を止める（CPU を食わない） |
| `onCommentSpoken({commentKey})` | 誰か1体が相槌を入れる。★**音声が鳴り始めた瞬間**に呼ぶ |
| `onCommentSpokenEnd()` | 相槌を畳む。音が止まったのに口が動き続ける事故を防ぐ |
| `onStreamerAddressed({prompt, answer})` | 話しかける。名指しがあればその子が答える |
| `beginThinking()` / `endThinking()` | 考え込む表現。★`endThinking` は必ず `finally` で呼ぶ |
| `destroy()` | 片付け |

---

## 設計

```
charaLiveState.js   … 判断（誰が喋る・どの表情・どこに浮かぶ）。DOM に触らない純関数
charaLiveStage.js   … 描画（状態を DOM に落とすだけ。判断を書かない）
charaLiveController.js … 配線とタイミング（rAF・相槌の間引き）
charaParts.js       … 表情+口 → 重ねる3枚のパーツパス
charaLiveCensus.js  … 計器（本当に見えているかを実測して1行にする）
```

### ★パーツ方式（合成済みではなく）

素材は **1500×1500px・同じ位置でぴったり重なる透過PNG**（`assets/characters/`）。
顔ベースの上に目と口を重ねる。

| 合成済み（移植元） | ★パーツ（このリポ） |
|---|---|
| 表情4×口2 = 8通りで固定 | 目と口が**独立して動く** |
| ★口パク中にまばたきできない | ★**喋りながらまばたきできる** |
| 表情を足すには絵が要る | 重ね方を変えるだけ |
| 先読み24枚 | 先読み**21枚で全組み合わせ** |

素材の**正本は `kimito-link/src/images/yukkuri-character-parts/`**。
ここへは取り込み済み（ファイル名は正本のまま＝更新は単純コピーで済む）。

---

## ★踏んではいけない罠（すべて実際に踏んだもの）

1. **`hidden` は `display:flex` に負ける**
   `display:flex` を持つ要素**すべて**に `[hidden] { display: none; }` の打ち消しが要る。
   移植元は `.nlcl-stage` にだけ書いていたため、このリポで
   `.nlcl-chara__think` が同じ穴に落ちた（誰も考えていないのに「…」が3体とも出た）。
   ★1箇所直して安心しない。

2. **`mount` 先に注意 — body 直下に置かない**
   移植元では body 直下に置いたら、同じ z-index の全画面要素に覆われて
   **一度も見えなかった**（同値 z-index は DOM 順で後勝ち）。
   ★寄生先の z-index は「最大値を名乗る」でなく**実測して1つ上**。

3. **`transform` は1本にまとめて書く**
   translate/rotate/scale を別々に当てると上書き事故になる。

4. **`pointer-events:none` は `elementFromPoint` に現れない**
   素朴に「最前面が自分か」で覆われ検出すると**必ず誤診する**（正常なのに赤が出た）。
   ★自分ではなく**祖先が返るか**で見る。計器の誤診は一番高くつく。

---

## テスト

```bash
npm test
```

73件。★「緑を出しっぱなしにしない」ことも試験している
（打ち消しを外すと実際に赤が出ることを確認するテストが入っている）。

---

## このリポの外（入っていないもの）

- 会話AI・APIキー
- 声（VOICEVOX）
- 配信サイト連携・コメント取得

芯の一文:

> **ただ一人で抱え込まないように そばにいることしかできない**

配信者がまだかけだしのとき／だれもいないときに、間を持たせる。
詳しい構想は `tsuioku-no-kirameki.com/_docs/CONCEPT-aibou-3nin-2026-09-04.md`。

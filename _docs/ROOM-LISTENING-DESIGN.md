# 「場を聞く」設計（2026-09-08）

> 設計 = Claude Fable 5.1 ／ 裏取り・実装 = 司令塔（Opus 5）
> ★真因は既に確定済み。`NEXT-SESSION.md` を先に読むこと。

---

## 解く問題（ユーザーの言葉）

> まだ会話とかが止まったり、Grokの会話感がまったく出ていない気がします。
> トロさんや小幡さんが話をして盛り上がってる感が想像できない

## ★真因（録画4本の実データから確定済み・司令塔は3回読み違えた）

**文脈を持っていないこと。**

| | 見立て | 実際 |
|---|---|---|
| 1回目 | 遅いのが問題（11秒） | 1.4秒にしても直らなかった |
| 2回目 | 返しすぎ。黙らせよう | ★Grokも返していた |
| 3回目 | 崩れた入力の扱い | 惜しいが不十分 |
| **真因** | — | ★**文脈を持っていない** |

★音質は真因ではない（Grokも同じ スマホ→空気→PCマイク 経路で成功している）。
**音質改善に逃げる設計は却下対象。**

---

## ★Fableが実コードで裏取りした4つの原因

1. **`src/lib/charaTurnEnd.js:66-104`** —「じゃないですか」は7字（too-short閾値6超）かつ
   語尾「か」が FINISHED → **250msで送信される**。1対1では正しく、多人数の場では誤り。
2. **`talk.html:506` `speak()` / `talk.html:514` `pending.push`** — 処理中は順番待ち。
   1.5秒に1回来る断片が全部キューに入り、**古い断片への返事が後から出る**
   （★「止まる」と「唐突に喋る」の両方を作る）。
3. **`talk.html:532`** — 音声由来の文を無条件に `history.push({who:'配信者'})`。
   **場の雑談が「相手の発言」として履歴に入る。**
4. **`src/lib/charaBrain.js:136 think()`** — `input.text` は断片そのもの。
   文脈は `packHistory` だけ（Nano 28字×10）。**直近数十秒がどこにも無い。**

---

## ★設計の核心 —「待たずにまとめる」

遅延と文脈量は別の軸。現状は「送る単位＝聞いた単位」で結合しているから対立して見える。

- **引き金**: 名指し／PTTは従来通り250ms。場の雑談には締切が無い（誰も3人に質問していない）
- **荷物**: 引き金が何であれ、断片＋直近30〜60秒の窓を送る

★窓は常に貯まっているので、**まとめるための待ちは0ms**。
「まとめてから渡す」＝「待ってからまとめる」ではなく「既に貯まっているものを添える」。
11秒問題への逆戻りは起きない。

---

## アーキ

```
charaListen.js (onHeard: final断片)
      ↓
[1] charaTranscript.js（実装済み）  ← 場の話を時刻付きで貯める「耳」
      ↓ windowText / charsSince / lastHeardAt
[2] charaBeat.js（実装済み）        ← 「いつ喋るか」を決める拍
      ↓ resolveBeat → {fire, reason}
[3] charaDigest.js（★未実装）      ← 何を渡すか＋出た返事がオウム返しか
      ↓ buildRoomDigest / roomAsk / isEcho
charaBrain.js think({ ..., room })  ← 既存。userブロックに「場の話」を1つ足すだけ
      ↓
talk.html speakRoom()（★未実装・pendingキューを通らない）
```

---

## ★実装済み（コミット 7f1a43d・286テスト green）

### `src/lib/charaTranscript.js`（152行）
`makeTranscript` / `appendFinal` / `markBlackout` / `windowText` / `charsSince` / `lastHeardAt`
定数: `KEEP_MS`(120000) / `KEEP_CHARS`(2000) / `GAP_SEP_MS`(700) / `DUP_MS`(3000)

- 相槌だけの発話を捨てる（★語を明示列挙。パターンを広げたら「ああとかね」まで消えた）
- 同じ文が3秒以内に再度来たら重複として捨てる（Web Speechが二重に返す）
- 700ms以上の間に区切り「／」（一続きの1文だとモデルに誤読させない・話者推定ではない）
- キャラが喋っていた区間は「…」（聞けていない所を繋げて復元させない）

### `src/lib/charaBeat.js`（103行）
`resolveBeat` / `isStaleBeat`
定数: `ROOM_LULL_MS`(1800) / `ROOM_MIN_CHARS`(40) / `ROOM_FORCE_CHARS`(90) /
　　　`ROOM_FORCE_GAP_MS`(12000) / `ROOM_MIN_GAP_MS`(8000) / `ROOM_STALE_MS`(5000)

★`ROOM_LULL_MS` は実測で選んだ（理屈で決めない）:

| 閾値 | 発火回数 | 内訳 | 判定 |
|---|---|---|---|
| 1500ms | 27回 | lull 23 : force 4 | ★FAIL（息継ぎを拾いすぎる） |
| **1800ms** | **24回** | **force 18 : lull 6** | ★**採用**（両方の経路が生きる） |
| 2000ms | 23回 | force 20 : lull 3 | 間の経路が痩せる |
| 2500ms | 22回 | force 21 : lull 1 | 実質forceだけ |

発話間隔の実測は 中央1514ms / 90%2025ms。**「発話の合間」そのものが1.5秒前後ある**ので、
閾値が短いと息継ぎを間と誤る。

---

## ★受け入れ基準（録画2相当 213発話/321秒・`charaBeat.test.js` で固定済み）

```
発火 213回 → 24回（基準15〜25）    ★PASS
窓40字未満  0回（基準0）            ★PASS
lull/force  両方の経路が生きている   ★PASS
```

---

## ★次にやること（MVPの残り）

### `talk.html` への配線
- トグル「場を聞く」（★既定OFF。PTT既定は守る）
- ON のとき `onHeard(final)` → `appendFinal(transcript, {source:'room'})`。
  **★`sendTimer` を動かさない**
- 500msティッカーで `resolveBeat` → fire なら `speakRoom()`
- **★`speakRoom` は `pending` を使わない**（古い断片への返事が後から出る原因）
- 発話前に `isStaleBeat` を見る。再生中は `ptt.mute()` を使い `markBlackout` を記録
- `isHeartTalk` → `runRelay` は `source==='host'` のときだけ（場の雑談で3人リレーを起こさない）
- 計器: ログ1行に 拍理由 / 窓字数 / 推論ms

### `charaBrain.js think()` の差分
- 入力に `room?: { digest, pickup? }` を追加
- `room` があるとき user ブロック = `場の話（直近）:\n{digest}\n\n{hist}\n\n{roomAsk}`
- **★「相手:「…」」行は作らない**（断片を主役にしない）
- ★`buildSystemPrompt` は触らない（systemを変えるとNanoセッションが作り直され11秒に戻る）

### `charaDigest.js`（次の段）
- `buildRoomDigest({window, brain})` — nano: 末尾140字 / fable: 800字
- `roomAsk(displayName, {pickup})` — 「誰か1人に返事するのではなく、話題に対して一言」
- `isEcho(reply, source)` — 引用比率LCS≥0.5 / なぞり出し / 断片の2倍未満
  ★**Grokの正解を落とさないこと**:「若い女に攻撃するおっさん、きついよね…」は
  LCS 12字/約50字=0.24 → 非エコー。「8字以上の一致で落とす」のような絶対値判定は禁止

---

## ★捨てた案と理由

- **待ち時間を伸ばして数秒ぶん貯める**（NEXT-SESSIONの字面通り）… 1回目の誤診への逆戻り
- **音質改善**（タブ音声・echoCancellation）… Grokが同じ空気経路で成功。却下条件そのもの
- **話者分離**… ブラウザ単体で不可能に近く、「話題に喋る」なら不要
- **LLMに窓を要約させてから渡す**… 往復が増え、Nanoは要約で崩す。末尾切りで足りる
- **3人リレーを場にも適用**… 悪循環の3倍化
- **`resolveTurnEnd` の too-short を広げる**…「じゃないですか」は塞げるが
  「守、私、ちんき」型は塞げない。引き金でなく荷物の問題

---

## ★地雷

1. **キャラ発話中は場を聞けない**（`ptt.mute()` 必須）。1文≈2秒の穴。
   → 1文厳守・`markBlackout` で窓に「…」・穴の割合をログに出す
2. **systemを変えるとNanoセッションが作り直され11秒に戻る**（`charaBrain.js:183`）
   → 場の指示は全部 user 側
3. **Nanoの入力上限（実測320〜350字）**。溢れると create 失敗→決め打ち台詞に落ちて
   ★画面上は正常に見える（潜伏型）。ログに文字数を出す
4. **エコー判定の絶対値は禁止**（Grokの正解を落とす）
5. **Web Speech の final 遅延・重複** → transcript で3秒内同文を捨てる。interimは使わない
6. **★拍のパラメータを理屈で決めない**。誤診の共通根は「観測せず理屈で埋めた」
7. **★測り方を実装と揃える**。発話のたびに拍を見る書き方だと `ROOM_LULL_MS=1200` でも
   通ってしまうが、実装と同じ500msティッカーで測ると31回発火していた（偽の緑を2回踏んだ）

---

## 未確認事項（断定していない）

- 録画2の final の到着遅延の実値
- Nanoで窓140字を足した時の create 成功率
- 「止まる」がキュー詰まりによるものか、ブラックアウトによるものかの内訳
- ★`ANTHROPIC_API_KEY` が未設定のため、Fable 5.1 での実測はできていない

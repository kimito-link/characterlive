/**
 * charaTurnEnd.js — 話し終わったかを「文の完結度」で判断する（純関数）。
 *
 * ★なぜ要るか（2026-09-06・実測から）
 *   1往復の内訳を測ったら **合計5.4秒** だった:
 *     話し終わり待ち 3500ms / 返事開始 2000ms / AI推論 1300ms / 合成 600ms
 *   人間同士の会話は平均208ms・最頻値0ms（Stivers 2009, PNAS。日本語は+7msで世界最速）。
 *   ★桁が2つ違う。これが「会話している感じが出ない」の正体。
 *
 * ★そのうち **3500ms は「無音を数えているだけ」**。ここが一番無駄。
 *   私が「言葉を奪わないように」と延ばした値だが、安全側に倒しすぎた。
 *
 * ★Grokとの本質的な差:
 *   Grokは無音の長さではなく「文が完結したか」で話し終わりを判断している。
 *   HNでの最多の不満も「沈黙を発話終了と扱う＝急かしてくる」であり、
 *   ★裏を返せば **無音だけで判断すると必ずどちらかで失敗する**:
 *     - 短くすると言葉を奪う（実害あり:「しゃべれる」「のに」だけがログに残った）
 *     - 長くすると会話にならない（いまの状態）
 *
 * ★だから待ち時間を**文ごとに変える**:
 *     言い切っている  → すぐ返す（250ms）
 *     続きそう        → 長く待つ（2500ms）
 *   これは KoljaB/RealtimeVoiceChat の turndetect.py と同じ発想。
 *   ★ただしあちらは日本語が扱えない（モデルに渡す前に
 *     `re.sub(r'[^a-zA-Z\s]+$','',text)` で日本語が丸ごと消える）。
 *   → ★日本語の「間」は自前で作るしかない。ここがこの製品の作りどころ。
 */

/** 言い切っているときの待ち時間（ms）。★ここを短くできるのが本命。 */
export const END_FAST_MS = 250;
/** 続きそうなときの待ち時間（ms）。 */
export const END_SLOW_MS = 2500;
/** どちらとも言えないとき。 */
export const END_MID_MS = 900;

/**
 * ★文が続きそうな終わり方（接続助詞・言いよどみ）。
 *   これで終わっていたら、まだ喋る。待つ。
 */
const CONTINUING = [
  // 接続助詞
  'けど', 'けれど', 'だけど', 'ので', 'から', 'のに', 'が', 'し',
  'て', 'で', 'たら', 'れば', 'ながら', 'つつ',
  // 言いよどみ
  'えっと', 'えーと', 'あの', 'そのー', 'なんか', 'まあ', 'ちょっと',
  'うーん', 'んー', 'えー'
];

/** ★言い切りの終わり方。これなら返してよい。 */
const FINISHED = [
  // 終助詞
  'よ', 'ね', 'な', 'わ', 'ぞ', 'ぜ', 'かな', 'かも', 'でしょ', 'じゃん',
  // 断定
  'だ', 'です', 'ます', 'した', 'ない', 'る', 'た',
  // 疑問
  'か'
];

/**
 * 話し終わったかを判定して、待つべき時間を返す。
 *
 * @param {string} text いま聞き取れている文
 * @param {{ isFinal?:boolean }} [opts] 音声認識が確定と言っているか
 * @returns {{ waitMs:number, reason:string, complete:boolean }}
 */
export function resolveTurnEnd(text, opts = {}) {
  const t = String(text || '').trim();
  if (!t) return { waitMs: END_SLOW_MS, reason: 'empty', complete: false };

  // ★句読点で終わっていれば、ほぼ確実に言い切っている
  if (/[。！？!?]$/.test(t)) {
    return { waitMs: END_FAST_MS, reason: 'punctuation', complete: true };
  }

  // ★「〜だけど」「えっと」で終わっていたら、まだ続く
  for (const w of CONTINUING) {
    if (t.endsWith(w)) {
      return { waitMs: END_SLOW_MS, reason: `continuing:${w}`, complete: false };
    }
  }

  /* ★短い発話は、まだ言い終わっていないことが多い。
     実害(2026-09-05):「しゃべれる」「のに」だけがログに残った。
     ★「しゃべれる」は語尾が「る」なので"言い切り"に見えるが、
       実際は「しゃべれるように…」の途中だった。
     → ★短い文では語尾の判定を信用しない。6字以下は必ず待つ。 */
  if (t.length <= 6) {
    return { waitMs: END_SLOW_MS, reason: 'too-short', complete: false };
  }

  // ★言い切りの語尾で終わっていれば返してよい
  for (const w of FINISHED) {
    if (t.endsWith(w)) {
      return { waitMs: END_FAST_MS, reason: `finished:${w}`, complete: true };
    }
  }

  // ★名詞で終わる文は判断が難しい（「今日は配信」＝続くかもしれない）
  return { waitMs: END_MID_MS, reason: 'unknown', complete: false };
}

/**
 * ★推論を先に始めてよいか（純関数）。
 *
 *   Levinsonの含意: 人は隙間200msで返すのに、発話の計画に600ms要る。
 *   ★この矛盾の答えは「聞きながら次を用意し、終わりを予測して出す」こと。
 *   → 途中経過でも「もう言い切っている」なら、**確定を待たずに考え始める**。
 *
 *   ★ただし短い断片で始めると無駄打ちになる（そのぶん電力と時間を捨てる）。
 *
 * @param {string} text
 * @returns {boolean}
 */
export function canStartThinking(text) {
  const t = String(text || '').trim();
  if (t.length < 6) return false;          // 断片では始めない
  return resolveTurnEnd(t).complete;
}

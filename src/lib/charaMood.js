/**
 * charaMood.js — その場の空気を1つの値にする（純関数）。
 *
 * ★なぜ要るか（2026-09-04・ユーザー要望）
 *   「わかってくれる感。superficial な返答じゃなく、文脈を拾って、
 *     その場の空気に合った長さで返す」
 *   「3人の掛け合いで、直前の発言と mood を引き継ぐ」
 *
 * ★AIに毎回「空気を読め」と書いても読まない（小型モデルは特に）。
 *   ★空気は**こちらで判定して、短い一言としてプロンプトに渡す**。
 *   Grokの調査結論と同じ:「空気を読む専用の機能は無い。
 *   VADの閾値・タイマー・プロンプトの3つでやっている」
 *
 * ★感情はターンを跨いで持続させる（Grok調査:「文ごとに作らず持続させる」）。
 *   1回の発言で判定を切り替えず、直近の履歴から連続量として出す。
 */

/** @typedef {'down'|'flat'|'up'} Mood */

/** ★落ち込みの語。配信者が実際に使う言葉を優先する。 */
const DOWN = [
  'つらい', '疲れた', 'しんどい', 'だめ', 'ダメ', '無理', 'むり',
  'うまくいかな', '失敗', 'ミス', 'やめたい', '寂し', 'さみし',
  '誰もいない', '0人', 'ゼロ', '来ない', 'コメント無い', 'こない',
  '不安', '怖い', 'こわい', '嫌', 'いやだ', 'ごめん', 'すみません',
  /* ★配信者が実際に漏らす言い方(2026-09-04・実害から追加)
     「フォロワー増えない」が flat と判定され、たぬ姉が
     「絶対」「信じてる」と上から励ましてしまった。
     ★数字が伸びない話は、この人たちにとって最も重い。必ず拾う。 */
  '増えない', '増えねえ', '伸びない', '伸びねえ', '減った', '減ってる', '下がった',
  'いない', '少ない', '全然', 'ぜんぜん', 'ダメだ',
  '意味ない', '意味がない', '向いてない', '才能',
  '飽きられ', '見てもらえ', '届かない', 'スルー', '反応ない',
  '落ち込', 'へこ', 'きつい', 'しんど', 'だるい', '諦め', 'あきらめ'
];

/** ★上がっている語。 */
const UP = [
  'うれし', '嬉し', '楽し', 'たのし', 'やった', 'できた', 'いけた',
  '最高', 'すごい', 'ありがと', '面白', 'おもしろ', '好き', '勝った',
  '成功', 'クリア', '初めて', 'はじめて'
];

/**
 * いまの空気を判定する。
 *
 * @param {Array<{who:string,text:string}>} history 直近の会話
 * @param {string} [latest] いま言われたこと（最も重く見る）
 * @returns {{ mood:Mood, score:number }} score は -1..1
 */
export function readMood(history = [], latest = '') {
  let score = 0;

  // ★いまの一言を最も重く見る（空気は今この瞬間のもの）
  score += scoreText(latest) * 1.0;

  // ★直近の履歴も引き継ぐ（1回の発言で切り替えない＝感情を持続させる）
  //   古いほど軽くする。
  const recent = history.filter((h) => h.who === '配信者').slice(-3);
  recent.forEach((h, i) => {
    const weight = 0.5 * ((i + 1) / recent.length); // 新しいほど重い
    score += scoreText(h.text) * weight;
  });

  const clamped = Math.max(-1, Math.min(1, score));
  if (clamped <= -0.3) return { mood: 'down', score: clamped };
  if (clamped >= 0.3) return { mood: 'up', score: clamped };
  return { mood: 'flat', score: clamped };
}

/** 1つの文の傾き。 */
function scoreText(text) {
  const t = String(text || '');
  if (!t) return 0;
  let s = 0;
  for (const w of DOWN) if (t.includes(w)) s -= 0.45;
  for (const w of UP) if (t.includes(w)) s += 0.45;
  return Math.max(-1, Math.min(1, s));
}

/**
 * 空気をプロンプトに入れる一言にする。
 *
 * ★長く書かない。小型モデルには**短い指示ほど効く**（プロンプト上限も厳しい）。
 * ★「相手は落ち込んでいます」と説明せず、**どう振る舞うか**を書く。
 *   説明すると、モデルはそれを言葉にして返してしまう（「落ち込んでるんだね」）。
 *
 * @param {Mood} mood
 * @param {boolean} isSafetyNet りんくかどうか
 * @returns {string}
 */
export function moodDirective(mood, isSafetyNet = false) {
  if (mood === 'down') {
    /* ★「まず受け止める」は全員に効かせる（りんくだけではない）。
       実害(2026-09-04): たぬ姉が「絶対」「信じてる」「すぐにたくさんの人が」と
       上から励ました。★励ましを急ぐのは、相手の状態を否定することになる。
       ★禁止する言葉を名指しする。曖昧な指示は小型モデルに効かない。 */
    const common = "励まさない。「絶対」「きっと」「信じてる」は使わない。";
    return isSafetyNet
      ? `まず受け止める。${common}`
      : `短く受け止める。茶化さない。${common}`;
  }
  if (mood === 'up') return '相手は機嫌がいい。乗ってよい。';
  return '';
}

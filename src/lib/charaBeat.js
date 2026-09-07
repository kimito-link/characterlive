/**
 * charaBeat.js — 「いま喋るか」だけを決める拍（純関数）。
 *
 * ★なぜ要るか（2026-09-07）
 *   Xスペースは1.5秒に1回、誰かが喋っている（5分21秒で213回・実測）。
 *   ★この213回すべてに返事をしていたのが「オウム返し」と「止まる」の正体。
 *   （talk.html の speak() は処理中に pending へ積むので、古い断片への返事が
 *     後から出る。会話が止まって見えるのも、唐突に喋るのも、同じ1つの原因）
 *
 * ★resolveTurnEnd（charaTurnEnd.js）とは別の問いを解く:
 *     resolveTurnEnd … 配信者1人が「言い終わったか」   → 250ms/2500ms
 *     resolveBeat    … 場に「間が来たか・話が進んだか」 → 十数秒に1回
 *   ★「じゃないですか」は7字で語尾が「か」なので resolveTurnEnd では
 *     FINISHED になり250msで送信される。これは1対1では正しく、場では誤り。
 *
 * ★名前を呼ばれたときだけは即答する（人が待っているので締切がある）。
 *   場の雑談には締切が無い。誰も3人に質問していないため。
 *
 * ★定数は暫定。理屈で決めない（司令塔の誤診の共通根＝観測せず理屈で埋めた）。
 *   録画2（5分21秒・213発話）の時刻列で fire 回数を測ってから調整する。
 *
 * 状態を持たない。タイマー・乱数・DOM を使わない。
 */

/**
 * 場の無音がこれ以上続いたら「間」とみなす。
 * ★1800ms は実測で選んだ（理屈で決めない）。
 *   録画2相当（213発話/321秒）の発話間隔は 中央1514ms / 90%2025ms。
 *   ★「発話の合間」そのものが1.5秒前後あるので、閾値が短いと息継ぎを間と誤る。
 *
 *   閾値ごとの実測（発火回数／内訳・受け入れ基準は15〜25回）:
 *     1500ms → 27回 ★FAIL（lull 23 : force 4）息継ぎを拾いすぎる
 *     1800ms → 24回  PASS （force 18 : lull 6）★両方の経路が生きる
 *     2000ms → 23回  PASS （force 20 : lull 3）間の経路が痩せる
 *     2500ms → 22回  PASS （force 21 : lull 1）実質 force だけになる
 *   ★1800を採る。間で入る挙動を残したいため。
 */
export const ROOM_LULL_MS = 1800;
/** 前回の拍からこれ未満しか進んでいなければ、間が来ても喋らない。 */
export const ROOM_MIN_CHARS = 40;
/** 間が来なくても、これだけ話が進んだら喋る。 */
export const ROOM_FORCE_CHARS = 90;
/** 上と併用。前回の発話からこれ以上あいていること。 */
export const ROOM_FORCE_GAP_MS = 12_000;
/** キャラの発話同士の最短間隔。★連発して場を邪魔しない。 */
export const ROOM_MIN_GAP_MS = 8_000;
/** 拍を決めてから実際に喋るまでにこれ以上かかったら捨てる（古い話への返事を防ぐ）。 */
export const ROOM_STALE_MS = 5_000;

/**
 * いま喋るかを決める。
 * @param {{
 *   nowMs:number,
 *   lastHeardAt:number|null,      最後に場で声がした時刻
 *   charsSinceLastBeat:number,    前回の拍から聞こえた文字数
 *   lastCharaAt:number|null,      前回キャラが喋った時刻
 *   addressed?:boolean            名前を呼ばれたか
 * }} input
 * @returns {{ fire:boolean, reason:'addressed'|'lull'|'force'|'gap'|'thin'|'talking' }}
 */
export function resolveBeat(input) {
  const nowMs = Number(input?.nowMs);
  if (!Number.isFinite(nowMs)) return { fire: false, reason: 'talking' };

  const lastHeard = Number.isFinite(input?.lastHeardAt) ? input.lastHeardAt : null;
  const lastChara = Number.isFinite(input?.lastCharaAt) ? input.lastCharaAt : null;
  const chars = Number(input?.charsSinceLastBeat) || 0;

  // ★名指しは最短間隔を無視して即答する（人が待っている）
  if (input?.addressed) return { fire: true, reason: 'addressed' };

  // まだ何も聞こえていない
  if (lastHeard === null) return { fire: false, reason: 'thin' };

  // ★直前に自分たちが喋ったばかりなら黙る
  if (lastChara !== null && nowMs - lastChara < ROOM_MIN_GAP_MS) {
    return { fire: false, reason: 'gap' };
  }

  const silentMs = nowMs - lastHeard;

  // ★間が来た。ただし話が薄いなら見送る（「じゃないですか」だけで喋らない）
  if (silentMs >= ROOM_LULL_MS) {
    if (chars < ROOM_MIN_CHARS) return { fire: false, reason: 'thin' };
    return { fire: true, reason: 'lull' };
  }

  // ★間が来ない場（喋り続けている）。溜まったら割り込む
  const sinceChara = lastChara === null ? Infinity : nowMs - lastChara;
  if (chars >= ROOM_FORCE_CHARS && sinceChara >= ROOM_FORCE_GAP_MS) {
    return { fire: true, reason: 'force' };
  }

  return { fire: false, reason: 'talking' };
}

/** 拍が古びていないか。★決めてから合成が終わるまでに場が進みすぎたら捨てる。 */
export function isStaleBeat({ resolvedAt, nowMs }) {
  const a = Number(resolvedAt);
  const b = Number(nowMs);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return b - a > ROOM_STALE_MS;
}

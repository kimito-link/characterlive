/**
 * charaBackchannel.js — 相槌を先に鳴らして、待ち時間を隠す。
 *
 * ★なぜ要るか（2026-09-06・実測から）
 *   1往復5.4秒のうち、推論1300ms＋合成600ms＝**1.9秒は「返事を作っている間」**。
 *   この間、画面は「考えています…」と出るだけで**無音**になる。
 *   ★人間の会話に無音の1.9秒はない。ここで「会話が止まった」と感じる。
 *
 * ★対処: 先に相槌を鳴らし、裏で本命を作る。
 *   実測: 相槌「うんうん」の合成は **339ms**（audio_query 22ms + synthesis 317ms）。
 *   ★さらに**起動時に作り置き**すれば 0ms で鳴らせる。
 *   → 体感の待ち時間が 1.9秒 → ほぼ0 になる。
 *
 * ★これは「ごまかし」ではない。人間も同じことをしている:
 *   Levinson の含意 — 人は隙間200msで返すのに発話の計画に600ms要る。
 *   その差を埋めているのが相槌と言いよどみ。
 *
 * ★ただし**毎回は鳴らさない**。
 *   相槌が毎ターン入ると、それ自体がうるさい（この製品の禁忌）。
 *   本命が速く返るときは不要。**遅くなりそうなときだけ**出す。
 */

import { PERSONAS } from './charaPersona.v1.js';
import { synthesize, playWav } from './charaVoice.js';

/** ★キャラごとの相槌。短いほど良い（長いと本命に食い込む）。 */
export const BACKCHANNELS = Object.freeze({
  rinku: ['うんうん', 'ふむふむ'],
  konta: ['うん！', 'へえ！'],
  tanunee: ['ふーん', 'なるほどね']
});

/** 作り置き。キャラ×台詞ぶんだけ持つ（数が少ないので全部持てる）。 */
const CACHE = new Map();

/** @param {string} charaId @param {number} i */
const key = (charaId, i) => `${charaId}:${i}`;

/**
 * 起動時に相槌を作り置きする。
 * ★失敗しても会話は続く（VOICEVOXが無い環境でも壊さない）。
 *
 * @param {Record<string, number>} [voices] キャラ→styleId（配信者が選んだ声）
 * @returns {Promise<{ok:boolean, made:number, ms:number}>}
 */
export async function warmUpBackchannels(voices = {}) {
  const t0 = performance.now();
  let made = 0;
  for (const [charaId, lines] of Object.entries(BACKCHANNELS)) {
    const styleId = voices[charaId] ?? PERSONAS[charaId]?.voice?.styleId;
    if (styleId == null) continue;
    for (let i = 0; i < lines.length; i += 1) {
      try {
        const wav = await synthesize(lines[i], { styleId });
        if (wav) { CACHE.set(key(charaId, i), wav); made += 1; }
      } catch { /* 作れなくても会話は続ける */ }
    }
  }
  return { ok: made > 0, made, ms: Math.round(performance.now() - t0) };
}

/**
 * 相槌を鳴らす（作り置きがあれば即座に）。
 *
 * @param {string} charaId
 * @param {{ seed?:number }} [opts] 同じ相槌が続かないように
 * @returns {{ ok:boolean, stop:()=>void, done:Promise<void> }|null}
 */
export function playBackchannel(charaId, opts = {}) {
  const lines = BACKCHANNELS[charaId];
  if (!lines?.length) return null;
  const i = Math.abs(Number(opts.seed) || 0) % lines.length;
  const wav = CACHE.get(key(charaId, i));
  if (!wav) return null;          // 作り置きが無ければ黙る（合成を待たない）
  const p = playWav(wav);
  return { ok: true, stop: p.stop, done: p.done };
}

/** 作り置きが用意できているか。 */
export function isWarm() {
  return CACHE.size > 0;
}

/** 声を変えたら作り直す（古い声の相槌が鳴らないように）。 */
export function clearBackchannels() {
  CACHE.clear();
}

/**
 * ★相槌を出すべきか（純関数）。
 *
 *   ★毎回は出さない。相槌が毎ターン入ると、それ自体がうるさい。
 *   出すのは「本命が遅くなりそうなとき」だけ。
 *
 * @param {{ lastThinkMs?:number, isRelay?:boolean }} input
 * @returns {boolean}
 */
export function shouldBackchannel(input = {}) {
  // ★リレー中は出さない（3人が順に喋るので、そこに相槌が挟まると渋滞する）
  if (input.isRelay) return false;
  // ★前回が速かったなら要らない（速いのに相槌を挟むと、逆に遅くなる）
  const last = Number(input.lastThinkMs);
  if (Number.isFinite(last) && last < 700) return false;
  return true;
}

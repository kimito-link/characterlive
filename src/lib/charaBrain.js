/**
 * charaBrain.js — 3人の返事を AI に作らせる。
 *
 * ★構成（移植元 tsuioku-no-kirameki.com の作法に合わせた3層）
 *     プロンプトを作る(純関数) → AIを呼ぶ(薄い) → 可否ゲート＋エラー写像(ここ)
 *   人格は charaPersona.v1.js が持ち、ここは呼ぶだけ。
 *
 * ★使うAI: Chrome 内蔵の LanguageModel（Gemini Nano）
 *   実測（2026-09-04・この環境）: availability='available' / 応答 0.6秒 / 日本語OK。
 *   鍵もサーバーも課金も要らない。会話は端末の外に出ない。
 *
 * ★誰が答えるか
 *   名前を呼ばれたらその子。呼ばれなければ「直前に喋った子以外」から選ぶ。
 *   3人が毎回喋ると個性が薄まる（調査:「自由に喋らせると全員が毎ターン喋る」）。
 */

import { PERSONAS, PERSONA_IDS, buildSystemPrompt, DEFAULT_MODE } from './charaPersona.v1.js';
import { detectAddressedChara } from './charaLiveState.js';

/** @typedef {'rinku'|'konta'|'tanunee'} CharaId */

/**
 * 内蔵AIが使えるか調べる。
 * ★例外を投げない。使えないのは普通のことなので、状態として返す。
 * @returns {Promise<{ok:boolean, state:string, reason?:string}>}
 */
export async function probeAi() {
  const LM = /** @type {any} */ (globalThis).LanguageModel;
  if (!LM || typeof LM.availability !== 'function') {
    return { ok: false, state: 'unavailable', reason: 'この端末では内蔵AIが使えません' };
  }
  try {
    const a = await LM.availability();
    if (a === 'available') return { ok: true, state: a };
    if (a === 'downloadable' || a === 'downloading') {
      return { ok: false, state: a, reason: 'AIモデルの準備中です（初回だけ時間がかかります）' };
    }
    return { ok: false, state: 'unavailable', reason: '内蔵AIが利用できません' };
  } catch (e) {
    return { ok: false, state: 'error', reason: String(e?.message || e) };
  }
}

/**
 * 誰が答えるかを決める。
 * @param {string} text 話しかけられた内容
 * @param {CharaId|null} lastSpeaker 直前に喋った子
 * @returns {CharaId}
 */
export function pickResponder(text, lastSpeaker = null) {
  const named = detectAddressedChara(text);
  if (named) return /** @type {CharaId} */ (named);
  const pool = PERSONA_IDS.filter((id) => id !== lastSpeaker);
  const list = pool.length ? pool : PERSONA_IDS;
  // 決定論にしない（同じことを言っても違う子が答えるほうが自然）
  return /** @type {CharaId} */ (list[Math.floor(Math.random() * list.length)]);
}

/**
 * 返事を1つ作る。
 *
 * ★短さを強制する（プロンプト側でも指示しているが、モデルが長く返すことがあるので後段でも切る）。
 *   声で読むので長い返事は体験を壊す。Grokのプロンプトも全ペルソナで "keep your responses brief"。
 *
 * @param {{ charaId:CharaId, text:string, mode?:string, history?:Array<{who:string,text:string}> }} input
 * @returns {Promise<{ok:boolean, text?:string, ms?:number, reason?:string}>}
 */
export async function think(input) {
  const charaId = input.charaId;
  const persona = PERSONAS[charaId];
  if (!persona) return { ok: false, reason: `unknown chara: ${charaId}` };

  const probe = await probeAi();
  if (!probe.ok) return { ok: false, reason: probe.reason };

  const system = buildSystemPrompt(charaId, { mode: input.mode || DEFAULT_MODE });

  // 直近のやりとりだけ渡す（内蔵AIは小型なので長い履歴は毒）
  const hist = (input.history || []).slice(-4)
    .map((h) => `${h.who}: ${h.text}`)
    .join('\n');
  const user = hist
    ? `これまでの会話:\n${hist}\n\n配信者:「${input.text}」\n\n${persona.displayName}として1〜2文で返して。`
    : `配信者:「${input.text}」\n\n${persona.displayName}として1〜2文で返して。`;

  const LM = /** @type {any} */ (globalThis).LanguageModel;
  const t0 = performance.now();
  let session;
  try {
    session = await LM.create({ initialPrompts: [{ role: 'system', content: system }] });
    const raw = await session.prompt(user);
    const text = tidy(raw);
    return { ok: true, text, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  } finally {
    try { session?.destroy?.(); } catch { /* no-op */ }
  }
}

/**
 * 返答を声で読める形に整える。
 * ★記号・箇条書き・鉤括弧を落とす。長すぎたら1文目で切る。
 * @param {unknown} raw
 * @returns {string}
 */
export function tidy(raw) {
  let t = String(raw ?? '').trim();
  // よくある前置きを落とす
  t = t.replace(/^(はい[、。]?|わかりました[、。]?|了解[、。]?)/, '').trim();
  // 記号・箇条書き・絵文字っぽいものを除去（声で読むため）
  t = t.replace(/^[「『]|[」』]$/g, '').replace(/^[-*・]\s*/gm, '');
  t = t.replace(/\s*\n+\s*/g, ' ').trim();
  // 長すぎたら最初の1文で切る
  if (t.length > 60) {
    const m = t.match(/^[^。！？!?]*[。！？!?]/);
    if (m) t = m[0];
  }
  if (t.length > 80) t = t.slice(0, 78) + '…';
  return t;
}

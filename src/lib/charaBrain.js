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
  // ★AIが使えなくても黙らない。声は必ず出す。
  //   実際に踏んだ不具合(2026-09-04):「読み上げがない」
  //   → 原因は音声側ではなく、AIが 'downloadable'(準備中) を返して think が失敗し、
  //     返事が作られないまま合成にも到達していなかった。
  //   ★内蔵AIは端末の都合でいつでも準備中になる。**AIの可否に声を依存させてはいけない。**
  if (!probe.ok) {
    return { ok: true, text: fallbackLine(charaId, input.text), ms: 0, fallback: true, reason: probe.reason };
  }

  const system = buildSystemPrompt(charaId, { mode: input.mode || DEFAULT_MODE });

  // 直近のやりとりだけ渡す（内蔵AIは小型なので長い履歴は毒）
  // ★履歴にも他の子の名前を出さない（プロンプト本体と同じ理由・Grokの指摘）
  //   「こん太: いいね！」をそのまま見せると、モデルは"使ってよい名前"として受け取る。
  //   誰が言ったかは「相手/あなた/仲間」で足りる（1〜2文の返事に人名は要らない）。
  const hist = (input.history || []).slice(-4)
    .map((h) => {
      if (h.who === '配信者') return `相手: ${h.text}`;
      return h.who === persona.displayName ? `あなた: ${h.text}` : `仲間: ${h.text}`;
    })
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
    const text = enforcePersona(tidy(raw), charaId);
    return { ok: true, text, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    // ★ここでも黙らない（上と同じ理由）
    return { ok: true, text: fallbackLine(charaId, input.text), ms: Math.round(performance.now() - t0), fallback: true, reason: String(e?.message || e) };
  } finally {
    try { session?.destroy?.(); } catch { /* no-op */ }
  }
}

/**
 * ★人格をコードで守る（プロンプトだけに頼らない）。
 *
 *   実際に踏んだ不具合(2026-09-04・ユーザーが試して発見):
 *     ① りんくが「りんく、応援してるよ」と【自分の名前で相手を呼んだ】
 *     ② 話しかけた人を「こん太」と呼んだ
 *     ③ 「こんふとし」のような崩れた呼び方が出た
 *   プロンプトで禁止しても、小型モデルは破る。**出力側で機械的に潰す**のが確実。
 *
 * @param {string} text
 * @param {CharaId} charaId
 * @returns {string}
 */
export function enforcePersona(text, charaId) {
  let t = String(text || '');
  const p = PERSONAS[charaId];
  if (!p) return t;

  // ★人名での呼びかけを落とす（「りんく、〜」「こん太！」など先頭・末尾の呼びかけ）
  const names = PERSONA_IDS.map((id) => PERSONAS[id].displayName);
  for (const n of names) {
    t = t.replace(new RegExp(`^${n}[、,。！!？?\s]+`), '');   // 文頭の呼びかけ
    t = t.replace(new RegExp(`[、,]\s*${n}[、,。！!？?]*$`), ''); // 文末の呼びかけ
    t = t.replace(new RegExp(`[、,]?\s*${n}[、,]\s*`), '');   // 文中の呼びかけ
  }

  // ★他の子の語尾が混ざったら落とす（「のだ」は りんく 専用）
  for (const ng of p.speech.forbidden) {
    if (ng.startsWith('〜')) continue;
    t = t.split(ng).join('');
  }

  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || '……';
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

/**
 * ★AIが使えないときの返事。**黙るより喋る**。
 *
 *   人格は charaPersona.v1.js の口調に合わせる（ここで新しい人格を作らない）。
 *   相手の名前は呼ばない（enforcePersona と同じ理由）。
 *
 * @param {CharaId} charaId
 * @param {string} said 話しかけられた内容（疑問形かどうかだけ見る）
 * @returns {string}
 */
export function fallbackLine(charaId, said = '') {
  const asked = /[?？]\s*$|ですか|かな$|どう(思う|かな)/.test(String(said));
  const table = {
    rinku: asked ? ['ボクはいいと思うのだ！', 'だいじょうぶなのだ！'] : ['うんうん、聞いてるのだ', 'いいと思うのだ！'],
    konta: asked ? ['ボクはいいと思うよ！', 'やってみたらいいよ！'] : ['ボク見てたよ、ちゃんと！', 'いまのよかったー！'],
    tanunee: asked ? ['まあ、やってみればいいのよ', 'そりゃ、あなたが決めることよ'] : ['ふーん、そうなの', 'まあ、いいんじゃない']
  };
  const list = table[charaId] || table.rinku;
  return list[Math.floor(Math.random() * list.length)];
}

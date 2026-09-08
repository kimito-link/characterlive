/**
 * charaDigest.js — 「場を聞く」モードで頭脳に何を渡すかを決める（純関数）。
 *
 * ★位置づけ（_docs/ROOM-LISTENING-DESIGN.md のアーキ [3]）
 *   charaTranscript（耳）→ charaBeat（拍）→ ここ（荷物）→ charaBrain.think({ room })
 *
 * ★設計の核心「待たずにまとめる」
 *   窓は耳に常に貯まっている。ここは**既に貯まっているものを切って添える**だけ。
 *   まとめるために待たない（待つ設計は11秒問題への逆戻り）。
 *
 * ★断片を主役にしない
 *   1対1の経路は「相手:「じゃないですか」」のように断片を主役にして渡していた。
 *   それが「じゃないですか、か！」のオウム返しの正体。
 *   場では「相手:「…」」行を**作らない**。話題に対して一言、と頼む。
 *
 * ★isEcho（出た返事がオウム返しか）は次の段。ここには入れない。
 *   入れるときは絶対値判定（「8字以上の一致で落とす」）を使わない。
 *   Grokの正解「若い女に攻撃するおっさん、きついよね…」は12字が一致するが正解。
 */

/** 内蔵AIに渡す窓の長さ。★入力上限（実測320〜350字）の中に履歴と指示も入れるため短い。 */
export const DIGEST_CHARS_NANO = 140;
/** クラウド頭脳に渡す窓の長さ。 */
export const DIGEST_CHARS_CLOUD = 800;

/**
 * 窓の文字列を頭脳ごとの長さに切る。★末尾（新しい方）を残す。要約はしない。
 * @param {{ window:string, brain?:'nano'|'fable' }} input
 * @returns {string}
 */
export function buildRoomDigest(input) {
  const w = String(input?.window || '').trim();
  if (!w) return '';
  const max = input?.brain === 'fable' ? DIGEST_CHARS_CLOUD : DIGEST_CHARS_NANO;
  return w.length > max ? w.slice(w.length - max) : w;
}

/**
 * 場に向けた頼み方。★「誰か1人に返事」ではなく「話題に一言」。
 * @param {string} displayName
 * @param {{ pickup?: string }} [opt] 拾ってほしい一語（あれば）
 * @returns {string}
 */
export function roomAsk(displayName, opt = {}) {
  const pickup = String(opt?.pickup || '').trim();
  return [
    `${displayName}として、いまの話題に一言だけ。`,
    '誰か1人に返事するのではなく、話題に対して言う。',
    pickup ? `「${pickup}」に触れる。` : '',
    '聞こえた言葉をそのまま繰り返さない。1〜2文。'
  ].filter(Boolean).join('');
}

/**
 * 頭脳に渡す user ブロックを組み立てる。
 * ★room があるときは「相手:「…」」行を作らない（断片を主役にしない）。
 *
 * @param {{
 *   text?: string,            1対1の発話（room が無いときだけ使う）
 *   hist?: string,            packHistory 済みの履歴（空可）
 *   ask: string,              毎回変わる指示行（状況＋長さの指示）
 *   room?: { digest: string } 場の窓（あれば場モード）
 * }} input
 * @returns {string}
 */
export function buildUserBlock(input) {
  const hist = String(input?.hist || '').trim();
  const ask = String(input?.ask || '').trim();
  const digest = String(input?.room?.digest || '').trim();

  if (digest) {
    return [
      `場の話（直近）:\n${digest}`,
      hist ? `これまでの会話:\n${hist}` : '',
      ask
    ].filter(Boolean).join('\n\n');
  }

  const text = String(input?.text || '');
  return [
    hist ? `これまでの会話:\n${hist}` : '',
    `相手:「${text}」`,
    ask
  ].filter(Boolean).join('\n\n');
}

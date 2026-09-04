/**
 * charaAddress.js — 名指しされたときの扱い（純関数）。
 *
 * ★設計はGrok本人に相談して確定した（2026-09-05）。以下は回答の要点。
 *
 *   1.「たぬ姉の言うとおりだ」は**質問ではなく同意**。
 *     → たぬ姉が1文だけ受ける。**新しい意見は出さない**。
 *     → ★他の2人は黙る。「すぐ誰かが拾うと、同意を会議にする」
 *
 *   2. 履歴は全部渡さない。**4つだけ**:
 *        今のユーザー発話 / 直前に喋った子の名前 / その子の最後の1文 / 今指名された子
 *     → 「それ以上足すと小型モデルは要約し始める」
 *
 *   3. 指名されていない2人は**声を出さない。相槌も打たない**。
 *     → 「配信の横だと、短い『うん』でもうるさい。動きだけでいい」
 *
 *   4.「どう思う？」は**役割を変えるだけで、長さは揃える**（みんな1文）。
 *
 *   ★(b) 直前の子と別の子が指名されたら、元の話題ではなく
 *     **直前の子の1文を踏まえる**。ただし「同意の言い直し」はしない。
 *     その1文を受けて、自分の役割で1文足す。
 */

import { PERSONA_IDS, PERSONAS } from './charaPersona.v1.js';
import { detectAddressedChara } from './charaLiveState.js';

/** @typedef {'question'|'agree'|'none'} AddressKind */

/**
 * 名指しの種類を見分ける（純関数）。
 *
 * ★「こん太、どう思う？」= 質問 → 答える
 * ★「たぬ姉の言うとおりだ」= 同意 → 1文だけ受ける。新しい意見は出さない
 *
 * @param {string} text
 * @returns {{ kind:AddressKind, charaId:string|null }}
 */
export function readAddress(text) {
  const t = String(text || '');
  const charaId = detectAddressedChara(t);
  if (!charaId) return { kind: 'none', charaId: null };

  // ★同意の型。「〜の言うとおり」「〜が正しい」「〜に賛成」
  //   ★これらは名前が入っていても**返事を求めていない**。
  const agree = new RegExp(
    '(の(言|い)う(とおり|通り)|の言うことも?わかる|が正しい|に賛成|もそう思|に同意)'
  ).test(t);
  if (agree) return { kind: 'agree', charaId };

  return { kind: 'question', charaId };
}

/**
 * AIに渡す文脈を4つに絞る（純関数）。
 *
 * ★Grok:「履歴は全部渡さない。渡すのは4つだけ。
 *         それ以上足すと小型モデルは要約し始める」
 *
 * @param {{
 *   text:string,
 *   charaId:string,
 *   history?:Array<{who:string,text:string}>
 * }} input
 * @returns {{ said:string, prevName:string|null, prevLine:string|null, selfName:string }}
 */
export function narrowContext(input) {
  const hist = Array.isArray(input.history) ? input.history : [];
  const selfName = PERSONAS[input.charaId]?.displayName || '';

  // 直前に喋った「子」を探す（配信者の発言は飛ばす）
  let prevName = null;
  let prevLine = null;
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    const h = hist[i];
    if (!h || h.who === '配信者') continue;
    if (h.who === selfName) break;   // 自分の発言まで遡ったら、そこで止める
    prevName = h.who;
    // ★最後の1文だけ（全文ではない）
    prevLine = String(h.text || '').split(/(?<=[。！？!?])/)[0] || String(h.text || '');
    break;
  }

  return { said: String(input.text || ''), prevName, prevLine, selfName };
}

/**
 * 名指しへの振る舞いを、プロンプトに足す一言にする（純関数）。
 *
 * ★長く書かない。プロンプトには250字の上限がある。
 *
 * @param {{ kind:AddressKind, charaId:string, prevName?:string|null, prevLine?:string|null }} input
 * @returns {string}
 */
export function addressDirective(input) {
  const lines = ['1文だけ。'];

  if (input.kind === 'agree') {
    /* ★同意には新しい意見を足さない（Grok:「そうなのだ」で止める）。
       ここで意見を足すと、同意が議論に変わる。 */
    lines.push('相手はあなたに同意しただけ。受けるだけにする。新しい意見を足さない。');
    return lines.join('');
  }

  // ★直前に別の子が喋っていたら、その1文を踏まえる（元の話題には戻らない）
  if (input.prevName && input.prevLine) {
    /* ★直前の1文は短く切ってから入れる（2026-09-05・実測）
       プロンプトには上限がある（実測320〜350字で create が失敗する）。
       ★最悪ケース（落ち込み＋名指し＋長い1文）で300字に達した。余裕が20字しかない。
       → ★実測338字（危険域）だったので、引用14字＋文言短縮で抑える。 */
    const quoted = String(input.prevLine).slice(0, 14);
    lines.push(`仲間が直前に「${quoted}」と言った。繰り返さず、自分の役割で1文足す。`);
  }

  // ★役割ごとの答え方（Grokの例をそのまま採る）
  const role = {
    rinku: '肯定ではなく受け止める。',
    konta: '素直に一段ずらす。',
    tanunee: 'ツッコミ1発で閉じる。'
  }[input.charaId];
  if (role) lines.push(role);

  return lines.join('');
}

/**
 * 名指しされていない子は黙る（純関数）。
 * ★Grok:「相槌も打たない。配信の横だと短い『うん』でもうるさい。動きだけでいい」
 *
 * @param {string} addressedId
 * @returns {string[]} 黙る子
 */
export function silentMembers(addressedId) {
  return PERSONA_IDS.filter((id) => id !== addressedId);
}

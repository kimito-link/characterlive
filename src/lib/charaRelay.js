/**
 * charaRelay.js — 気持ちの話に3人が1文ずつリレーで返す（純関数）。
 *
 * ★なぜ要るか（2026-09-05 ユーザー指示・デモ録画のため）
 *   「配信の横でゆっくり3人が応援している」ことを、会話の質だけで見せる。
 *   1人が長く喋るより、★3人が短く繋ぐ方が「3人いる」ことが伝わる。
 *
 * ★守ること（指示そのまま）
 *   - 1人1文 / 最大3人 / 順番は りんく → こん太 → たぬ姉 で固定
 *   - 前の人の再生が終わってから次が吹き出す（同時発話は禁止のまま）
 *   - 「私も好き」禁止（好きの投げ返し禁止）/「あらあら」禁止
 *
 * ★役割
 *   りんく = 受け止める（励ましを急がない）
 *   こん太 = 少しずらして軽くする
 *   たぬ姉 = 1文で閉じる
 *
 * ★リレーを出す条件は絞る。何にでも3人が出てくると、
 *   「3人が毎ターン喋って個性が薄まる」失敗（調査で確認済み）に戻る。
 */

import { PERSONA_IDS } from './charaPersona.v1.js';

/** リレーの順番。★固定（指示）。 */
export const RELAY_ORDER = Object.freeze(['rinku', 'konta', 'tanunee']);

/** リレー中は1人1文に固定する。 */
export const RELAY_MAX_SENTENCES = 1;

/**
 * 気持ちの話かどうか（純関数）。
 *
 * ★事実の質問（「これどうやるの」）では出さない。
 *   打ち明け・自己開示・弱音のときだけ3人で受ける。
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isHeartTalk(text) {
  const t = String(text || '');
  if (t.length < 6) return false;              // 相槌のような短文では出さない

  // 打ち明けの型（「言えないけど」「実は」など、言いにくさが混ざる）
  const confession = /(恥ずかし|言えな|言いにく|実は|正直|本音|うまく言えな)/.test(t);
  // 気持ちを名指ししている
  const feeling = /(好き|嬉し|うれし|楽し|たのし|辛い|つらい|寂し|さみし|不安|怖い|こわい|感謝|ありがと)/.test(t);
  // 自分を変えたい・なりたい
  const wish = /(なりたい|変わりたい|頑張りたい|がんばりたい|できるように)/.test(t);

  // ★2つ以上そろったときだけ。1つだと日常会話でも当たってしまう。
  return [confession, feeling, wish].filter(Boolean).length >= 2;
}

/**
 * リレーの各順番で、その子に何をさせるか（プロンプトに足す一言）。
 *
 * ★「受け止めて」と書くだけでは足りない。**禁止を名指しする**。
 *   Grokのプロンプトが決まり文句を名指しで禁じているのと同じ手法。
 *
 * @param {string} charaId
 * @param {number} index リレーの何番目か（0始まり）
 * @returns {string}
 */
export function relayDirective(charaId, index) {
  /* ★全員に共通の禁止（好きの投げ返し・あらあら）は残す。
     ただし★「何もしない」指示は外した（2026-09-06・Grokの助言）。

     Grok:「1人だけ答える、名指し以外は黙る、役割固定、同意は新意見なし——
            破綻を防ぐルールとしては正しい。でも全部、
            **"盛り上がらない会話"を保証するルール**でもある」

     ★以前のりんくは「励まさない。助言しない」＝何もするなと言われていた。
       禁止で埋めると、当たり障りのない一言しか出てこない。
     → ★何をするかを書く。禁止は最小限にする。 */
  const banned = '「私も好き」と返さない。「あらあら」と言わない。';
  const one = '1文だけ。';

  if (index === 0) {
    /* りんく = 気持ちを守る。★ただし事実は歪めない。
       Grokの例:「しんどかったよね。でも今日の何が一番引っかかってる？」
       ★受け止めるだけで終わらせない。相手が次に何か言いたくなる形にする。 */
    return `${one}相手の気持ちを言葉にする。取り繕わない。${banned}`;
  }
  if (index === 1) {
    /* こん太 = 可能性を信じる。★ただし甘やかさない。
       Grokの例:「失敗したって言うけど、視聴者はそこ見てたと思うよ」
       ★褒めるのではなく、相手が見落としている良い面を指す。 */
    return `${one}相手が見落としている面を一つ指す。ほめない。${banned}`;
  }
  /* たぬ姉 = 視聴者目線の本音。★ただし人格は否定しない。
     Grokの例:「で、次に同じことするつもり？」
     ★★ここが「反応したくなる」の要。逃げ道を残しつつ、次の一手を相手に返す。 */
  return `${one}言いにくいことを一つ言う。人格は否定しない。${banned}`;
}


/**
 * リレーに参加する子を順に返す。
 * @param {number} [count]
 * @returns {string[]}
 */
export function relayMembers(count = 3) {
  const n = Math.max(1, Math.min(RELAY_ORDER.length, Number(count) || 3));
  return RELAY_ORDER.slice(0, n).filter((id) => PERSONA_IDS.includes(id));
}

/**
 * リレーで出た文が禁止に触れていないか（純関数）。
 * ★プロンプトで禁じても小型モデルは破る。出た文を検査して落とす。
 *
 * @param {string} text
 * @returns {{ok:boolean, reason?:string}}
 */
export function checkRelayLine(text) {
  const t = String(text || '');
  if (!t.trim()) return { ok: false, reason: 'empty' };
  if (/私も好き|ぼくも好き|ボクも好き|あたしも好き/.test(t)) {
    return { ok: false, reason: '好きの投げ返しは禁止' };
  }
  if (/あらあら/.test(t)) return { ok: false, reason: '「あらあら」は禁止' };
  return { ok: true };
}

/**
 * charaReplyGuard.js — 頭脳の返事が「返事の形をした失敗」でないかを見る（純関数）。
 *
 * ★なぜ要るか（2026-09-07・実害）
 *   開発用ブラウザの内蔵AI（スタブ）が `prompt()` の戻り値として
 *   「On-device model is not available in Chromium…」という英語のエラー文や、
 *   渡した user プロンプトの先頭（「これまでの会話: 相手: …」）を返した。
 *   charaBrain はそれを検証せず、**そのまま こん太 の台詞として吹き出しに出した**
 *   （決め打ちにも落ちない＝失敗として扱われていなかった）。
 *   ★場モードでは毎拍これが出るので雑音になる。
 *
 * ★見るのは「形」だけ。内容の良し悪しは判断しない（それは別の段の仕事）。
 */

/** プロンプトの足場（user 側の見出し）。返事にこれが混ざっていたら足場を復唱している。 */
const SCAFFOLD = ['これまでの会話:', '場の話（直近）:', '相手:「', 'あなた: ', '仲間: '];

/**
 * @param {unknown} raw   頭脳の戻り値
 * @param {string} [user] 渡した user ブロック（あれば復唱判定に使う）
 * @returns {{ ok:boolean, reason?:string }}
 */
export function looksBrokenReply(raw, user = '') {
  if (typeof raw !== 'string') return { ok: false, reason: '文字列ではない' };
  const t = raw.trim();
  if (!t) return { ok: false, reason: '空' };

  // ★足場の復唱（プロンプトの見出しがそのまま返っている）
  for (const s of SCAFFOLD) {
    if (t.includes(s)) return { ok: false, reason: `プロンプトの足場を復唱（${s.trim()}）` };
  }
  // ★渡した user の先頭20字がそのまま入っている（入力をそのまま返している）
  const head = String(user || '').trim().slice(0, 20);
  if (head.length >= 10 && t.includes(head)) return { ok: false, reason: '入力をそのまま返した' };

  // ★英語のエラー文（日本語で喋る子が英字だらけの文を返すことはない）
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (t.length >= 16 && letters / t.length > 0.5) return { ok: false, reason: '英字だらけ（エラー文の疑い）' };

  return { ok: true };
}

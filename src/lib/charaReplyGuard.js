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

/**
 * 履歴の見出し（「相手:」「あなた:」「仲間:」）を人の名前として喋っていないか（純関数）。
 *
 * ★実害（2026-09-14・ログの実物）:
 *   りんく「仲間さんが、あなたのお気持ちを尊重してほしいみたいなのね」
 *   → 履歴に「仲間: そりゃ、あなたが決めることよ」と渡した見出しを、
 *     小型モデルが「仲間さん」という人物として語った。
 * ★「仲間」「相手」という語そのものは普通の会話でも使うので、
 *   人名扱いの形（〜さん／〜くん／〜が言った／〜の言葉）だけを見る。
 *
 * @param {string} text
 * @returns {boolean}
 */
export function leaksScaffold(text) {
  const t = String(text || '');
  return /(仲間|相手)(さん|くん|ちゃん|君)|(仲間|相手)(が|は|も)(言|話|そう)|(仲間|相手)の(言葉|発言|気持ち)/.test(t);
}

/**
 * 直前の自分の返事の使い回しか（純関数）。
 *
 * ★根拠: 離脱理由の1位が「同じ話の繰り返し」（本調査 §7-A・Replika 12件／Character.AI 7件／Cotomo 7件）。
 *   Grok の実会話でも、食い下がられて同じ文を3回返した（REFERENCE-grok-voice 2-3）。
 * ★絶対値で判定しない（「8字以上の一致で落とす」は正解も落とす）。
 *   2文字の並び（bigram）の重なりを**比率**で見る。短い相槌（「うん」「へえ」）は対象外。
 *
 * @param {string} prev 直前の自分の返事
 * @param {string} next 今回の返事
 * @param {number} [threshold] 重なり比率（Jaccard）。既定 0.6
 * @returns {boolean}
 */
export function isRepeatOf(prev, next, threshold = 0.6) {
  const a = norm(prev);
  const b = norm(next);
  if (!a || !b) return false;
  if (a === b) return true;
  // ★短い返事同士は「繰り返し」と呼ばない（相槌が毎回違うことは要求しない）
  if (a.length < 8 || b.length < 8) return false;
  const ga = bigrams(a);
  const gb = bigrams(b);
  let inter = 0;
  for (const g of ga) if (gb.has(g)) inter += 1;
  const union = ga.size + gb.size - inter;
  return union > 0 && inter / union >= threshold;
}

/**
 * マイクで拾った文が、キャラが直前に喋った文の「反響」か（純関数）。
 *
 * ★isRepeatOf（全体の重なり比率）では足りなかった実害（2026-09-14）:
 *   拾うのは台詞の**後半だけ**（再生終了の合図と実際に音が止まるまでのずれ）。
 *   「の気持ちを尊重して本当に必要な言葉を送って」は45字の台詞の後半20字で、
 *   全体比率だと 0.43 になり通ってしまった。
 * → 拾った文の側から見て「その2文字の並びのほとんどが台詞の中にある」なら反響とみなす。
 *   ★これも比率（拾った文の中の割合）。「N字一致で落とす」の絶対値は使わない。
 *
 * @param {string} heard  マイクで拾った文
 * @param {string} spoken キャラが喋った文
 * @param {{ minChars?:number, ratio?:number }} [opt]
 * @returns {boolean}
 */
export function isEchoOf(heard, spoken, opt = {}) {
  const minChars = Number(opt.minChars) > 0 ? Number(opt.minChars) : 6;
  const ratio = Number(opt.ratio) > 0 ? Number(opt.ratio) : 0.7;
  const h = norm(heard);
  const s = norm(spoken);
  if (h.length < minChars || !s) return false;
  if (s.includes(h)) return true;
  const gh = bigrams(h);
  const gs = bigrams(s);
  if (!gh.size) return false;
  let inter = 0;
  for (const g of gh) if (gs.has(g)) inter += 1;
  return inter / gh.size >= ratio;
}

function norm(s) {
  return String(s || '').replace(/[、。！？!?\s「」…]/g, '').trim();
}
function bigrams(s) {
  const g = new Set();
  for (let i = 0; i + 1 < s.length; i += 1) g.add(s.slice(i, i + 2));
  return g;
}

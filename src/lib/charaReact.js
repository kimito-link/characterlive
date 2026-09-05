/**
 * charaReact.js — 「反応したくなる返答」の骨格（純関数）。
 *
 * ★なぜ要るか（2026-09-06・Grokに相談して判明した最大の設計ミス）
 *
 *   ユーザーの実感:「grokの会話感がまったく出ていない。
 *   トロさんや小幡さんが話をして盛り上がってる感が想像できない」
 *
 *   Grokの回答（要点）:
 *     「速さの問題じゃない。1往復が1秒になっても、いまの設計のままなら
 *       "会話してる感じ"は出ない。欠けてるのはレイテンシじゃなく、
 *       ★相手の予想を壊す力と、人間が反応せざるを得ない圧力」
 *
 *     「最大の誤りは、"安全な会話ルール"を先に固めすぎたこと。
 *       1人だけ答える／名指し以外は黙る／役割固定／同意は新意見なし——
 *       破綻を防ぐルールとしては正しい。でも全部、
 *       ★"盛り上がらない会話"を保証するルールでもある」
 *
 *     「いまのシステムは良い司会者。必要なのは良い相手役。
 *       ★司会は安全、相手役は危険。配信が盛り上がるのは後者」
 *
 * ★目的関数を変える（これがこのファイルの正体）
 *     いままでの暗黙の目的: 破綻なく、キャラらしく、順番よく返す
 *     ★必要な目的        : 配信者の次の感情を動かす一言を返す
 *
 * ★「反応したくなる」の最小要件（Grokの3点をそのまま実装する）
 *     ① 相手の言葉の急所を拾う（要約ではなく、痛いところ）
 *     ② 逃げ道を一つ残す（全否定しない）
 *     ③ 次の一手を相手に返す（質問・選択・決断を迫る）
 *   → ★「正論パンチ」は正しさそのものではなく、
 *     **逃げられない形で正しさを返すこと**。
 *
 * ★ここは「面白いAI」を作る場所ではない（Grokの対比）:
 *     面白いAI        → 自分が面白い。危険は独りよがり
 *     反応したくなるAI → 相手の感情を動かす。危険は刺さりすぎ
 *   ★刺さりすぎを止めるのが②の「逃げ道」。りんくの安全網もそのために残す。
 */

/** @typedef {'rinku'|'konta'|'tanunee'} CharaId */

/**
 * 相手の言葉から「急所」を拾う（純関数）。
 *
 * ★要約ではない。**本人が一番気にしている一語**を取る。
 *   「フォロワー増えない」なら急所は「増えない」であって「フォロワー」ではない。
 *
 * @param {string} text
 * @returns {{ point:string|null, kind:string }}
 */
export function findSorePoint(text) {
  const t = String(text || '');

  // ★数字が伸びない話。配信者にとって最も重い（実害から確認済み）
  const number = t.match(/(増えない|伸びない|減った|来ない|いない|0人|ゼロ|少ない)/);
  if (number) return { point: number[1], kind: 'numbers' };

  // ★自己否定。ここを拾わないと「わかってくれない」になる
  const self = t.match(/(向いてない|才能|意味ない|できない|だめ|ダメ|無理)/);
  if (self) return { point: self[1], kind: 'self-doubt' };

  // ★続けるかどうかの迷い。もっとも反応が大きい
  const quit = t.match(/(やめたい|辞めたい|続かない|限界|しんどい|つらい)/);
  if (quit) return { point: quit[1], kind: 'quitting' };

  // ★比較。他人と比べているとき
  const compare = t.match(/(みんな|他の人|あの人|周り|比べ)/);
  if (compare) return { point: compare[1], kind: 'comparison' };

  return { point: null, kind: 'none' };
}

/**
 * 「反応したくなる返答」の作り方を、プロンプトに足す一言にする。
 *
 * ★短く書く（プロンプトは350字で失敗する）。
 * ★キャラごとに**判断基準**が違うので、同じ急所でも答えの方向が変わる。
 *
 * @param {{ charaId:CharaId, point:string|null, kind:string, allowPush?:boolean }} input
 * @returns {string}
 */
export function reactDirective(input) {
  const { charaId, point, kind } = input;
  if (!point) return '';

  /* ★③次の一手を返す = 相手に決めさせる。
     ここが無いと「言われて終わり」になり、会話が続かない。
     ★ただし全員が質問すると尋問になるので、たぬ姉だけに持たせる。 */
  const parts = [`相手は「${point}」を気にしている。そこに触れる。`];

  if (charaId === 'rinku') {
    // ★①急所に触れるが、②逃げ道は最大に残す（安全網なので）
    parts.push('気持ちを言葉にする。解決しようとしない。');
  } else if (charaId === 'konta') {
    // ★本人が見落としている面を指す。ほめるのではない
    parts.push('本人が見ていない面を一つだけ言う。');
  } else {
    /* ★たぬ姉が「反応したくなる」の要。
       Grokの例:「で、次に同じことするつもり？」
       ★逃げられない形にするが、人格は否定しない。 */
    parts.push('言いにくいことを言う。最後に相手へ問いを返す。');
  }

  return parts.join('');
}

/**
 * ★刺さりすぎを止める（純関数）。
 *
 *   Grok:「反応したくなるAIの危険は刺さりすぎ」
 *   ★人格否定・命令・決めつけは、逃げ道を塞ぐ。ここだけは通さない。
 *
 * @param {string} text
 * @returns {{ ok:boolean, reason?:string }}
 */
export function checkNotTooHarsh(text) {
  const t = String(text || '');

  // ★人格の否定（「あなたは〜な人」型）
  if (/(だから|そういう所が|そんなんだから)/.test(t)) {
    return { ok: false, reason: '人格の否定に読める' };
  }
  // ★決めつけ（逃げ道を塞ぐ）
  if (/(絶対に無理|向いてない|やめた方がいい|才能ない)/.test(t)) {
    return { ok: false, reason: '逃げ道を塞いでいる' };
  }
  // ★命令
  if (/(しろ|やめろ|するな)$/.test(t.replace(/[。！？!?]$/, ''))) {
    return { ok: false, reason: '命令になっている' };
  }
  return { ok: true };
}

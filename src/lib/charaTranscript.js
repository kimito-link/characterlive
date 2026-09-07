/**
 * charaTranscript.js — 場で聞こえた話を時刻つきで貯める「耳」（純関数）。
 *
 * ★なぜ要るか（2026-09-07・録画4本の実測から）
 *   真因は【文脈を持っていないこと】だった。司令塔は3回読み違えている:
 *     1回目「遅いのが問題(11秒)」→ 1.4秒にしても直らなかった
 *     2回目「返しすぎ。黙らせよう」→ ★Grokも返していた
 *     3回目「崩れた入力の扱い」→ 惜しいが不十分
 *
 * ★決定的な証拠（同じXスペースの音声・同じスマホ→空気→PCマイク経路）:
 *     Grok          「…そういう意味では、守、私、ちんき、あー。」
 *                 → 「君が守ってあげたいって思う気持ち、わかる」
 *                    ★崩れを捨て「守」の一文字から意図を復元した
 *     characterlive 「じゃないですか」
 *                 → 「じゃないですか、か！さすが、キミの言葉は鋭いな。」
 *                    ★断片をそのままオウム返しした
 *   ★同じ音を聞いて結果が正反対。差は【入力】でなく【入力の扱い方】にある。
 *   （だから音質の改善に逃げてはいけない。Grokは同じ劣化音で成功している）
 *
 * ★この部品の役割は「窓」を常に持っておくこと。
 *   Xスペースは1.5秒に1回、誰かが喋っている（5分21秒で213回・実測）。
 *   その一つ一つに返事をするのが間違いで、直近数十秒を**まとめて**渡す。
 *   ★重要: 「まとめる」ために待つのではない。既に貯まっているものを添えるだけ。
 *     待つ設計は1回目の誤診（11秒問題）への逆戻りになる。
 *
 * ★話者は特定しない。多人数の場でブラウザ単体の話者分離は現実的でないし、
 *   「誰に返すか」を無くせば「誰が言ったか」は要らなくなる。
 *   ただし700ms以上の間には区切り記号を入れる（一続きの1人の文だとモデルが
 *   誤読して勝手に復元するのを防ぐため。話者推定ではない）。
 *
 * 状態は呼び出し側が持つ（charaChatter.js と同じ流儀。タイマー・乱数・DOM を使わない）。
 */

/** 窓に残す長さ（ms）。これより古い発話は落とす。 */
export const KEEP_MS = 120_000;
/** 窓に残す最大文字数。超えたら古い順に落とす。 */
export const KEEP_CHARS = 2000;
/** この間隔以上あいたら「話者が変わったかもしれない」印を入れる。 */
export const GAP_SEP_MS = 700;
/** 同じ文がこの時間内に再度来たら重複とみなす（Web Speech は同文を2回返すことがある）。 */
export const DUP_MS = 3000;

/**
 * ★相槌だけの発話。文脈にならないので捨てる。
 * ★語を明示的に並べる。パターンを広げると本文まで巻き込む
 *   （`^(あ|…)[ーぁ-ん、。]*$` と書いたら「ああとかね」まで消えた。テストで捕まえた）
 * ★長音符と句読点は末尾の飾りとしてだけ許す（「んー」「うんうん。」は実際に出る）。
 */
const FILLER_WORDS = [
  'あ', 'い', 'う', 'え', 'お', 'ん',
  'あー', 'えー', 'おー', 'んー', 'へー', 'ほー', 'ふーん', 'へえ', 'ふん',
  'うん', 'うーん', 'ううん', 'うんうん',
  'はい', 'はいはい', 'ええ', 'そう', 'そうそう', 'なるほど', 'まあ'
];
const FILLER_ONLY = new RegExp(`^(?:${FILLER_WORDS.join('|')})[、。!?！？\s]*$`);

/** 新しい耳を作る。 */
export function makeTranscript() {
  return { items: [], blackouts: [] };
}

/**
 * 確定した発話を1件足す。★interim（途中経過）は入れない（書き換わるため）。
 * @param {{items:Array,blackouts:Array}} state
 * @param {{ text:string, tMs:number, source?:'room'|'host' }} heard
 * @returns {{items:Array,blackouts:Array}} 新しい state（元は変えない）
 */
export function appendFinal(state, heard) {
  const text = String(heard?.text || '').trim();
  const tMs = Number(heard?.tMs);
  if (!text || !Number.isFinite(tMs)) return state;
  if (FILLER_ONLY.test(text)) return state;

  const items = state.items || [];
  // ★直前と同じ文が短時間に来たら重複（Web Speech の確定が二重に届くことがある）
  const last = items[items.length - 1];
  if (last && last.text === text && tMs - last.tMs < DUP_MS) return state;

  const next = items.concat([{ text, tMs, source: heard.source === 'host' ? 'host' : 'room' }]);
  return { ...state, items: prune(next, tMs) };
}

/** 古い発話を落とす（時間と文字数の両方で頭打ちにする）。 */
function prune(items, nowMs) {
  let out = items.filter((it) => nowMs - it.tMs <= KEEP_MS);
  let chars = out.reduce((n, it) => n + it.text.length, 0);
  while (out.length > 1 && chars > KEEP_CHARS) {
    chars -= out[0].text.length;
    out = out.slice(1);
  }
  return out;
}

/**
 * キャラが喋っていてマイクを止めていた区間を記録する。
 * ★この間の場の話は聞けていない。窓では「…」にして、前後を1文に繋げさせない。
 */
export function markBlackout(state, { fromMs, toMs }) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return state;
  const blackouts = (state.blackouts || [])
    .concat([{ fromMs, toMs }])
    .filter((b) => toMs - b.toMs <= KEEP_MS);
  return { ...state, blackouts };
}

/**
 * 直近の窓を1つの文字列にする。
 * @param {{items:Array,blackouts:Array}} state
 * @param {{ nowMs:number, spanMs?:number, maxChars?:number, sep?:string }} opt
 * @returns {string} 例: 「港区の話でさ／ああとかね／…／若い女に攻撃するおっさん」
 */
export function windowText(state, opt) {
  const nowMs = Number(opt?.nowMs);
  if (!Number.isFinite(nowMs)) return '';
  const spanMs = Number(opt?.spanMs) > 0 ? Number(opt.spanMs) : 60_000;
  const maxChars = Number(opt?.maxChars) > 0 ? Number(opt.maxChars) : 800;
  const sep = typeof opt?.sep === 'string' ? opt.sep : '／';

  const from = nowMs - spanMs;
  const items = (state.items || []).filter((it) => it.tMs >= from && it.tMs <= nowMs);
  if (!items.length) return '';

  const blackouts = (state.blackouts || []).filter((b) => b.toMs >= from);
  const parts = [];
  let prev = null;
  for (const it of items) {
    if (prev) {
      // ★聞けていなかった区間があれば「…」を挟む（繋げて復元させない）
      const gapped = blackouts.some((b) => b.fromMs >= prev.tMs && b.toMs <= it.tMs);
      if (gapped) parts.push('…');
      else if (it.tMs - prev.tMs >= GAP_SEP_MS) parts.push(sep);
    }
    parts.push(it.text);
    prev = it;
  }
  // ★溢れたら末尾（新しい方）を残す。要約はしない（小型モデルは要約で崩す）。
  const joined = parts.join('');
  return joined.length > maxChars ? joined.slice(joined.length - maxChars) : joined;
}

/** ある時刻より後に聞こえた文字数。★「拍」が量を判断するために使う。 */
export function charsSince(state, tMs) {
  const from = Number(tMs);
  if (!Number.isFinite(from)) return 0;
  return (state.items || []).reduce((n, it) => (it.tMs > from ? n + it.text.length : n), 0);
}

/** 最後に何か聞こえた時刻。無ければ null。 */
export function lastHeardAt(state) {
  const items = state.items || [];
  return items.length ? items[items.length - 1].tMs : null;
}

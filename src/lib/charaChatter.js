/**
 * charaChatter.js
 *
 * 「勝手に喋り続ける」= **視聴者が 0 人でも沈黙させない**ための台詞と間合い(純関数)。
 *
 * ★なぜこれが要るのか(このファイルの存在理由・消さないこと):
 *   参照した4コマの芯は【視聴者0なのに、なんでこんなにうるさいのだ】。
 *   つまりこの部品の価値は「コメントに反応できること」ではなく、
 *   **コメントが1件も来なくても場が途切れないこと**にある。
 *   既存の onCommentSpoken / onStreamerAddressed は【外から入力がある】前提なので、
 *   誰も来ない配信では一言も喋らない = 4コマの体験にならない。
 *   だからここは【入力ゼロでも回る】ことだけを担う。
 *
 * 設計原則(このリポの既存 charaLiveState.js と同じ):
 *   - DOM / タイマー / 乱数に触らない。nowMs は必ず外から注入する。
 *   - 乱数は使わない。時刻と seed からハッシュで導く決定論。
 *     ("勝手に喋っている"ように見せるのに Math.random は要らない。
 *      決定論なら同じ入力で同じ結果 = テストで台詞と間合いを固定できる)
 *
 * ★3人の口調は混ぜない(4コマで役割が描き分けられている):
 *   りんく  = 無条件肯定・自分も一緒にやる。「〜のだ」
 *   こん太  = 素直・元気・まっすぐ褒める。ため口
 *   たぬ姉  = 冷静なツッコミ。でも最後は肯定する。落ち着いた口調
 */

/**
 * @typedef {'rinku'|'konta'|'tanunee'} CharaId
 * @typedef {'greet'|'idle'|'cheer'|'tease'|'silence'} ChatterKind
 *   greet   = 配信の入り口(開始直後)
 *   idle    = ただの雑談(間を埋める)
 *   cheer   = 励まし(無条件肯定)
 *   tease   = 軽いいじり(たぬ姉が主役・場が締まる)
 *   silence = 長く静かなときに「居るよ」と伝える
 */

/**
 * キャラ別・種類別の台詞。
 *
 * ★1行は短く。吹き出しは3行で切れる(charaLiveStage.css)ので、
 *   長文を入れても読めない。声に出したとき2秒以内で終わる長さにする。
 *
 * @type {Readonly<Record<CharaId, Readonly<Record<ChatterKind, readonly string[]>>>>}
 */
export const CHATTER_LINES = Object.freeze({
  rinku: Object.freeze({
    greet: Object.freeze([
      'はろー！今日もやっていくのだー！',
      '今日もはじめるのだ！',
      'よーし、やるのだ！'
    ]),
    idle: Object.freeze([
      'いい感じなのだ〜',
      'ボクも見てるのだ！',
      'ふむふむ、なるほどなのだ',
      'たのしくなってきたのだ！'
    ]),
    cheer: Object.freeze([
      'りんくは頑張ってるのだ！えらいのだ〜！',
      'ボクは4回目でもちゃんと聞くのだ！',
      'だいじょうぶなのだ！',
      'その調子なのだー！'
    ]),
    tease: Object.freeze([
      'そこは言わなくていいのだ……',
      'ぐっ……！それはそれで恥ずかしいのだ！'
    ]),
    silence: Object.freeze([
      'ボクたちはいるのだ！',
      'いつもそばにいるのだ〜！',
      'ひとりじゃないのだ'
    ])
  }),
  konta: Object.freeze({
    greet: Object.freeze([
      'いるよー！ボクずっと見てたよ！',
      'はじまったー！',
      'きょうもよろしくね！'
    ]),
    idle: Object.freeze([
      'おお〜',
      'そうなんだ！',
      'ボク、それ好きだなあ',
      'ふーん、へえー！'
    ]),
    cheer: Object.freeze([
      '3回目ならボクもう覚えたよ！次はいっしょに言えるよ！',
      'いまのよかったー！',
      'すごいすごい！',
      'ボク見てたよ、ちゃんと！'
    ]),
    tease: Object.freeze([
      'あ、今の失敗した？',
      'えー、ほんとにー？'
    ]),
    silence: Object.freeze([
      'ボクずっとhere だよ！',
      'ねえねえ、なんか話してよー',
      'しずかだね。でもいるよ！'
    ])
  }),
  tanunee: Object.freeze({
    greet: Object.freeze([
      'はいはい、今日も始めましょうか',
      'さて、やりますか',
      'まあ、ゆっくりやりなさいな'
    ]),
    idle: Object.freeze([
      'ふぅん',
      'まあ、悪くないんじゃない',
      'そういうこともあるわよ',
      'なるほどね'
    ]),
    cheer: Object.freeze([
      'でも、まだ配信切ってないじゃない。だったら続ければいいのよ',
      'ちゃんとやれてるわよ',
      '焦らなくていいのよ',
      'あなたのペースでいいの'
    ]),
    tease: Object.freeze([
      'そりゃそうよ。あなた今日、同じ話もう3回してるもの',
      'まあ…"視聴者"ではないけどね。',
      'いや、今のは普通に操作ミスよ',
      '聞こえてるわよ、全部'
    ]),
    silence: Object.freeze([
      'いるわよ。心配しなくていいの',
      'そこにいるわ',
      'ひとりじゃないわよ'
    ])
  })
});

/* ------------------------------------------------------------------ *
 * 決定論の抽選(Math.random を使わない)
 * ------------------------------------------------------------------ */

/**
 * FNV-1a 32bit。charaLiveState.js と同じ手法。
 * @param {unknown} value
 * @returns {number}
 */
function fnv1a32(value) {
  const s = String(value ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    hash ^= s.charCodeAt(i) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 配列から決定論的に1つ選ぶ。
 * @template T
 * @param {readonly T[]} list
 * @param {unknown} seed
 * @returns {T|null}
 */
export function pickDeterministic(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[fnv1a32(seed) % list.length];
}

/* ------------------------------------------------------------------ *
 * 間合い(いつ喋るか)
 * ------------------------------------------------------------------ */

/*
 * ★間隔は「急かさない」側に倒す(2026-09-04・Grokに相談して確定)
 *
 *   当初は 9〜20秒 だった。これは**急かす側**だと分かったので大きく空けた。
 *   - Grok:「配信者向けなら急かさない方が正義。silence_duration は長め。
 *            ★プロンプトだけでは急かしは直らない。タイマーと発話権が先」
 *   - kazuya_bros(1年かけて同種を作った人):
 *     「ゲームプレイ中にランダムに割り込まれると配信のテンポが非常に悪くなる」
 *   - yuki-P:「AIが全ての発言に反応すると主張が強くなりすぎてしまいます」
 *
 *   ★ただし黙らせきらない(Grokの補足・製品の芯と一致):
 *     「0人配信向けなら idle を完全オフより『稀に一言だけ・答えを求めない』方が
 *       目的に合う。★急かすのは silence 判定の短さで、存在感は別物」
 *   → 頻度は落とすが、居ることはやめない。答えを求めない台詞に限る(isSafeIdleLine)。
 *
 *   ★この値を小さくする"改善"は劣化。charaChatter.test.js が下限を固定している。
 */

/** 自発発話の最短間隔(ms)。これより短い間隔では喋らない。 */
export const CHATTER_MIN_GAP_MS = 45_000;
/** 自発発話の最長間隔(ms)。これだけ黙ったら必ず何か言う(沈黙を放置しない)。 */
export const CHATTER_MAX_GAP_MS = 90_000;
/**
 * 「静かすぎる」と判断する境目(ms)。
 * 配信者もコメントもこれだけ動きが無ければ、silence 系(「いるよ」)を出す。
 */
export const CHATTER_LONELY_MS = 45_000;

/**
 * 次に喋るまでの待ち時間(ms)を決める。
 *
 * ★等間隔にしない: きっちり15秒ごとだと機械に見える。
 *   seed(何回目の発話か)でゆらがせて「気が向いたら喋っている」風にする。
 *
 * @param {number} turn 何回目の自発発話か(0始まり)
 * @returns {number} ms
 */
export function nextChatterDelayMs(turn) {
  const u = fnv1a32(`gap:${turn}`) / 0x100000000; // 0..1
  return Math.round(CHATTER_MIN_GAP_MS + u * (CHATTER_MAX_GAP_MS - CHATTER_MIN_GAP_MS));
}

/**
 * いま自発的に喋ってよいか。
 *
 * 歯止め:
 *   - 前回の自発発話から十分に間が空いていること
 *   - ★外の出来事(コメント読み上げ・呼びかけ)の直後は黙る
 *     (せっかく人が喋ったのに、かぶせて自分語りを始めない)
 *
 * @param {{
 *   nowMs: number,
 *   lastChatterAtMs: number,
 *   lastExternalAtMs?: number,
 *   turn?: number,
 *   quietAfterExternalMs?: number
 * }} input
 * @returns {boolean}
 */
export function shouldChatter(input) {
  const now = Number(input?.nowMs) || 0;
  const last = Number(input?.lastChatterAtMs);
  const turn = Number.isFinite(input?.turn) ? Number(input.turn) : 0;
  // ★人が喋った直後に譲る時間。6秒では続きを言いかけた相手にかぶる。
  const quietAfter = Number.isFinite(input?.quietAfterExternalMs)
    ? Number(input.quietAfterExternalMs)
    : 12_000;
  const lastExternal = Number(input?.lastExternalAtMs);

  // 外の出来事の直後は譲る(人の発言にかぶせない)。
  if (Number.isFinite(lastExternal) && now - lastExternal < quietAfter) return false;

  // ★初回も間を置く(2026-09-04変更)。
  //   以前は「開いた瞬間に居ることを見せる」ため即発話していたが、
  //   開くのは配信の準備中であることが多く、いきなり話しかけられるのは急かしそのもの。
  //   居ることは画面に3人が浮いている時点で既に伝わっている。
  if (!Number.isFinite(last)) {
    const started = Number(input?.startedAtMs);
    if (!Number.isFinite(started)) return false;
    return now - started >= CHATTER_MIN_GAP_MS;
  }

  return now - last >= nextChatterDelayMs(turn);
}

/**
 * どの種類の台詞を出すか決める。
 *
 * ★長く静かなら silence(「いるよ」)を優先する。これが4コマの芯。
 * ★たまに cheer(励まし)を混ぜる。ずっと idle だと「ただの置物」になる。
 *
 * @param {{ nowMs: number, lastExternalAtMs?: number, turn?: number, startedAtMs?: number }} input
 * @returns {ChatterKind}
 */
export function resolveChatterKind(input) {
  const now = Number(input?.nowMs) || 0;
  const turn = Number.isFinite(input?.turn) ? Number(input.turn) : 0;
  const startedAt = Number(input?.startedAtMs);
  const lastExternal = Number(input?.lastExternalAtMs);

  // 開始直後の1回目は挨拶(配信の入り口)。
  if (turn === 0) return 'greet';

  // ずっと誰も来ていない = 4コマの本題。「いるよ」と伝える。
  const quietBase = Number.isFinite(lastExternal)
    ? lastExternal
    : Number.isFinite(startedAt)
      ? startedAt
      : now;
  if (now - quietBase >= CHATTER_LONELY_MS) {
    // 静かな時間が続くほど silence を出しやすくするが、毎回同じだと重いので混ぜる。
    const u = fnv1a32(`kind:lonely:${turn}`) % 3;
    return u === 0 ? 'cheer' : 'silence';
  }

  const u = fnv1a32(`kind:${turn}`) % 10;
  if (u < 2) return 'cheer';
  if (u < 3) return 'tease';
  return 'idle';
}

/**
 * 次に喋る子を決める。
 *
 * ★直前に喋った子は選ばない(独り言の連投に見せない)。
 * ★tease は たぬ姉が主役(4コマの役割)。ただし たぬ姉が直前だったら他に回す。
 *
 * @param {{ kind: ChatterKind, turn: number, lastSpeaker?: CharaId|null }} input
 * @returns {CharaId}
 */
export function pickChatterSpeaker(input) {
  const kind = input?.kind;
  const turn = Number(input?.turn) || 0;
  const last = input?.lastSpeaker ?? null;

  // 冷静なツッコミは たぬ姉の役。連投にならない限りは たぬ姉に回す。
  if (kind === 'tease' && last !== 'tanunee') return 'tanunee';

  const pool = /** @type {CharaId[]} */ (['rinku', 'konta', 'tanunee']).filter((id) => id !== last);
  const list = pool.length ? pool : /** @type {CharaId[]} */ (['rinku', 'konta', 'tanunee']);
  return list[fnv1a32(`who:${kind}:${turn}`) % list.length];
}

/**
 * 1回ぶんの自発発話(誰が・何を言うか)を組み立てる。
 *
 * @param {{
 *   nowMs: number,
 *   turn: number,
 *   lastSpeaker?: CharaId|null,
 *   lastExternalAtMs?: number,
 *   startedAtMs?: number
 * }} input
 * @returns {{ charaId: CharaId, text: string, kind: ChatterKind }}
 */
export function buildChatterLine(input) {
  const kind = resolveChatterKind(input);
  const charaId = pickChatterSpeaker({
    kind,
    turn: Number(input?.turn) || 0,
    lastSpeaker: input?.lastSpeaker ?? null
  });
  const lines = CHATTER_LINES[charaId][kind];
  const text =
    pickDeterministic(lines, `line:${charaId}:${kind}:${input?.turn ?? 0}`) ||
    // 万一 kind に台詞が無くても黙らせない(idle に倒す)。
    pickDeterministic(CHATTER_LINES[charaId].idle, `fallback:${input?.turn ?? 0}`) ||
    '……';
  return { charaId, text, kind };
}

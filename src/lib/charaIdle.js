/**
 * charaIdle.js — 「黙る」を担当する（純関数）。
 *
 * ★なぜ必要か（2026-09-04・Grokに相談して確定した設計）
 *   Grokの回答（原文の要点）:
 *     「配信者向けなら急かさない方が正義。thresholdは高め、silence_durationは長め、
 *       idleは『配信中はほぼ発動しない』か『稀に一言だけ』にすべき。
 *       ★プロンプトだけでは急かしは直らない。タイマーと発話権が先。」
 *   → ★**空気を読むのはプロンプトの仕事ではない。ここ（タイマー）の仕事。**
 *
 * ★そして0人配信向けには「完全オフ」も間違い（Grokの補足・重要）:
 *     「0人配信向けなら idle を完全オフより、『稀に一言だけ・答えを求めない』の方が
 *       製品の目的に合う。★急かすのは silence 判定の短さで、存在感は別物。」
 *   → ★**「急かす」と「居る」は別物**。だから黙らせきらない。ただし答えを求めない。
 *     視聴者0人の配信者を独りにしない、という製品の芯はここで守られる。
 *
 * ★いま実装済みの自発発話（9〜20秒ごと）は、この基準では**急かす側**。
 *   kazuya_bros（1年かけて同種を作った人）の失敗と同じ:
 *   「ゲームプレイ中にランダムに割り込まれると配信のテンポが非常に悪くなる」
 *   → 間隔を大きく空け、かつ**相手が喋った直後は絶対に割り込まない**。
 */

/**
 * ★「話し終わったと判断するまでの間」(2026-09-04・Grok本人に音声で相談)
 *
 *   Grokの回答:「間は1.5〜2秒。3人いると誰かが必ず拾うから、
 *               長すぎると会話が死ぬ」
 *
 * ★★これは IDLE_DEFAULTS.quietMs(45秒) とは**別の時計**。混同すると設計が壊れる。
 *     - ここ(2秒)      = 話しかけられた → いつ返事を始めるか（速さの話）
 *     - quietMs(45秒)  = 誰も何も言わない → いつこちらから声をかけるか（存在感の話）
 *   Grok本人も「急かすのは silence 判定の短さで、存在感は別物」と言っている。
 *   ★2秒の方を45秒に引きずられて伸ばすと「返事が遅い」、
 *     45秒の方を2秒に引きずられて縮めると「急かす」。どちらも失敗。
 */
export const REPLY_AFTER_SILENCE_MS = 2000;

/**
 * ★マイクで話しているときに「話し終わった」と判断するまでの間(ms)。
 *
 *   ユーザー報告(2026-09-05):「自分のことばがうまくログに残らないかも」
 *   実害:「しゃべれる」「のに」「あーなるほど」だけがログに残っていた。
 *   ★2秒では、文の途中の息継ぎで切られる。人は考えながら喋るので間が空く。
 *     Grokへの最多の不満も「沈黙を発話終了と扱う＝急かしてくる」だった。
 *
 *   ★REPLY_AFTER_SILENCE_MS(2秒)と分ける理由:
 *     - あちら = 文字で入力された/確定した言葉に、いつ返事を始めるか
 *     - こちら = まだ**話している最中かもしれない**人を、いつ待ち終えるか
 *     後者は長めでよい。待ちすぎても「聞いてくれている」になるが、
 *     短すぎると**言葉を奪う**。
 */
export const MIC_END_OF_SPEECH_MS = 3500;

/** ★既定値。すべて「黙る側に倒す」向きで決めている。 */
export const IDLE_DEFAULTS = Object.freeze({
  /** 相手が黙ってからこれだけ経つまで、こちらからは何も言わない（ミリ秒） */
  quietMs: 45000,
  /** 一度喋ったら、次までこれだけ空ける（連投は空気が読めていない筆頭） */
  cooldownMs: 90000,
  /** ★相手が喋っている最中・直後は割り込まない猶予 */
  guardMs: 3000,
  /** 一度に喋るのは1人だけ（Grok:「毎ターン全員喋らせない」） */
  maxSpeakers: 1
});

/**
 * いま自分から話しかけてよいか（純関数・時計もAIも触らない）。
 *
 * ★既定は「黙る」。喋るのは条件を満たしたときだけ（逆にしない）。
 *
 * @param {{
 *   now:number,
 *   lastUserSpokeAt:number|null,   最後に相手が喋った時刻
 *   lastSelfSpokeAt:number|null,   最後にこちらが喋った時刻
 *   userIsSpeaking?:boolean,       いま相手が喋っている
 *   isThinking?:boolean,           返事を作っている最中
 *   enabled?:boolean
 * }} s
 * @param {typeof IDLE_DEFAULTS} [cfg]
 * @returns {{ speak:boolean, reason:string, waitMs:number }}
 */
export function shouldSpeakUp(s, cfg = IDLE_DEFAULTS) {
  if (s.enabled === false) return { speak: false, reason: 'disabled', waitMs: Infinity };

  // ★相手が喋っている間は絶対に喋らない。ここが「急かさない」の本体。
  if (s.userIsSpeaking) return { speak: false, reason: 'user-speaking', waitMs: cfg.guardMs };
  if (s.isThinking) return { speak: false, reason: 'thinking', waitMs: cfg.guardMs };

  const sinceUser = s.lastUserSpokeAt == null ? Infinity : s.now - s.lastUserSpokeAt;
  const sinceSelf = s.lastSelfSpokeAt == null ? Infinity : s.now - s.lastSelfSpokeAt;

  // ★喋り終わった直後は間を置く（相手が続けるかもしれない）
  if (sinceUser < cfg.guardMs) {
    return { speak: false, reason: 'just-spoke', waitMs: cfg.guardMs - sinceUser };
  }
  // ★連投しない
  if (sinceSelf < cfg.cooldownMs) {
    return { speak: false, reason: 'cooldown', waitMs: cfg.cooldownMs - sinceSelf };
  }
  // ★十分に静かになるまで待つ（ここを短くすると「急かす」になる）
  if (sinceUser < cfg.quietMs) {
    return { speak: false, reason: 'not-quiet-yet', waitMs: cfg.quietMs - sinceUser };
  }
  return { speak: true, reason: 'quiet', waitMs: 0 };
}

/**
 * ★自分から話しかけるときの台詞の性質。
 *   Grok:「稀に一言だけ・**答えを求めない**」
 *   → 質問で終わらせない。相手に返事の義務を作らないことが「急かさない」の核心。
 * @param {string} line
 * @returns {boolean} 自発発話として出してよいか
 */
export function isSafeIdleLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  // ★疑問形は不可（答えを求めてしまう）
  if (/[?？]$/.test(t)) return false;
  if (/(どう(です|)か|ですか|ますか|かな)[?？]?$/.test(t)) return false;
  // ★長い独白も不可（一言だけ）
  if (t.length > 24) return false;
  return true;
}

/**
 * charaVoiceTone.js — 声から「元気があるか」を測る（純関数＋薄い計測）。
 *
 * ★なぜ要るか（2026-09-06・ユーザーの観察）
 *   ユーザーの言葉:「そういえば、grokは声の出し方で元気があるとかないとかも
 *   返答かえてたきがする」
 *
 *   ★これは体験価値③「予測が外れる」に直結する。
 *     同じ「大丈夫だよ」でも、明るく言ったのか、力なく言ったのかで意味が逆になる。
 *     ★文字だけ見ていると、その差が全部消える。
 *
 *   ★いま音量は測っているのに、波形を描くだけで捨てていた（実装を確認）。
 *     測っているのに使っていないのは、いちばんもったいない状態だった。
 *
 * ★何を測るか（マイクから安く取れるものだけ）
 *   - 声の大きさ（元気の指標。小さい＝疲れ・落ち込み）
 *   - 話す速さ（速い＝興奮・焦り / 遅い＝疲れ・考えている）
 *   - 声の揺れ（一定＝淡々 / 揺れる＝感情が乗っている）
 *
 * ★測れないもの（正直に書く）
 *   声の高さ（ピッチ）は取れるが、個人差が大きく、
 *   その人の平常時を知らないと意味がない。★最初の数分は判断材料にならない。
 *   → **その人の中での相対変化**で見る。絶対値では判断しない。
 */

/** @typedef {{ level:number, speed:number, variance:number }} ToneSample */

/**
 * 声の特徴をためる器。
 * ★その人の平常時を覚えて、そこからの変化を見る。
 *   絶対値（何dB）では人によって意味が違う。
 */
export function createToneTracker({ warmupSamples = 40 } = {}) {
  /** @type {number[]} 音量の履歴（平常時を知るため） */
  const levels = [];
  /** いま話している一区切りの中の音量 */
  let current = [];
  let startedAt = 0;

  return {
    /** 話し始め */
    begin(nowMs) {
      current = [];
      startedAt = Number(nowMs) || 0;
    },

    /** 音量が届くたびに呼ぶ（0..1） */
    push(level) {
      const v = Number(level);
      if (!Number.isFinite(v)) return;
      // ★無音は数えない（間が空いただけで「小さい声」になってしまう）
      if (v > 0.05) {
        current.push(v);
        levels.push(v);
        if (levels.length > 600) levels.shift();   // 直近だけ覚える
      }
    },

    /**
     * 話し終わり。★その人の平常時と比べた結果を返す。
     * @param {number} nowMs
     * @param {number} charCount 聞き取れた文字数（話す速さの計算に使う）
     */
    end(nowMs, charCount = 0) {
      const ms = Math.max(1, (Number(nowMs) || 0) - startedAt);
      const sample = summarize(current, ms, charCount);
      current = [];
      return {
        ...sample,
        // ★平常時が分かるまでは判断しない
        ready: levels.length >= warmupSamples,
        baseline: average(levels)
      };
    },

    /** 平常時の音量（まだ分からなければ null） */
    baseline() {
      return levels.length >= warmupSamples ? average(levels) : null;
    },

    reset() { levels.length = 0; current = []; }
  };
}

/** 一区切りの声を要約する（純関数）。 */
export function summarize(samples, durationMs, charCount = 0) {
  const arr = Array.isArray(samples) ? samples.filter((n) => Number.isFinite(n)) : [];
  if (!arr.length) return { level: 0, speed: 0, variance: 0 };

  const level = average(arr);
  // ★話す速さ = 文字数 / 秒。日本語の平均は毎秒6〜8字前後
  const speed = charCount > 0 ? charCount / (durationMs / 1000) : 0;
  // ★声の揺れ = 音量のばらつき。淡々と喋ると小さくなる
  const variance = Math.sqrt(average(arr.map((v) => (v - level) ** 2)));

  return { level, speed, variance };
}

/**
 * ★声から「元気があるか」を判定する（純関数）。
 *
 *   ★絶対値では判断しない。**その人の平常時と比べる**。
 *     大きい声の人と小さい声の人がいる。基準を固定すると必ず誤診する。
 *
 * @param {ToneSample & {baseline?:number|null, ready?:boolean}} t
 * @returns {{ tone:'low'|'flat'|'high', reason:string }}
 */
export function readTone(t) {
  const ready = t?.ready !== false;
  const base = Number(t?.baseline);
  const level = Number(t?.level);

  // ★平常時が分からないうちは判断しない（誤診より無判断のほうがまし）
  if (!ready || !Number.isFinite(base) || base <= 0 || !Number.isFinite(level)) {
    return { tone: 'flat', reason: 'not-ready' };
  }

  const ratio = level / base;
  const speed = Number(t?.speed) || 0;
  const variance = Number(t?.variance) || 0;

  // ★声が小さく、抑揚も少ない = 元気がない
  if (ratio < 0.7 && variance < 0.12) {
    return { tone: 'low', reason: 'quiet-and-flat' };
  }
  // ★声が小さいだけでも、平常のかなり下なら拾う
  if (ratio < 0.55) return { tone: 'low', reason: 'very-quiet' };

  // ★大きく、速く、抑揚がある = 元気/興奮
  if (ratio > 1.25 && speed > 7) return { tone: 'high', reason: 'loud-and-fast' };
  if (ratio > 1.4) return { tone: 'high', reason: 'very-loud' };

  return { tone: 'flat', reason: 'normal' };
}

/**
 * 声の調子を、プロンプトに足す一言にする（純関数）。
 *
 * ★短く書く。そして★「元気がない」と説明しない。
 *   説明するとモデルがそのまま言葉にする（「元気ないね」）。
 *   ★どう振る舞うかだけを書く。これは mood と同じ設計。
 *
 * @param {'low'|'flat'|'high'} tone
 * @returns {string}
 */
export function toneDirective(tone) {
  if (tone === 'low') return '声が小さい。こちらも静かに、短く返す。';
  if (tone === 'high') return '声が大きい。こちらも乗ってよい。';
  return '';
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

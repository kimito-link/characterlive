/**
 * charaLiveController.js
 *
 * 「キャラライブ」の配線係。charaLiveState(判断) と charaLiveStage(描画) を繋ぎ、
 *   実際のイベント源(読み上げ・配信者の呼びかけ・AI 思考)に接続する。
 *
 * ここが持つ唯一の責務は **タイミング**:
 *   - 毎フレーム描く(rAF)
 *   - 「いつ」相槌を入れるか = 読み上げが本当に鳴った瞬間(onAudioStart)
 *   - 「いつ」黙るか       = 読み上げが終わった瞬間(onAudioEnd)
 *
 * ★相槌を「コメントが届いた瞬間」でなく「読み上げが鳴った瞬間」に出すのが肝。
 *   届いた瞬間に出すと、読み上げキューが詰まっている時に **声より先にキャラが相槌を打つ**
 *   (聞く前に頷く)ことになり、露骨に嘘くさくなる。voicePlayer は v0.1.799 で
 *   onAudioStart(本当に audio.play() が走った時だけ)/ onAudioEnd / onDropped(鳴らず破棄)
 *   を出せるようになっているので、それに乗る。
 *   ※onPlayStart は「再生でも破棄でも鳴る」曖昧な信号なので **使わない**。
 *
 * DOM/chrome への依存は注入で受ける(テスト可能に保つ)。
 */

import {
  makeInitialCharaLiveState,
  expireCharaModes,
  triggerCharaReaction,
  triggerCharaAnswer,
  startCharaThinking,
  endCharaThinking,
  buildCharaLiveRenderModel,
  REACT_MIN_MS
} from './charaLiveState.js';
import { shouldChatter, buildChatterLine } from './charaChatter.js';
import { isSafeIdleLine } from './charaIdle.js';
import {
  buildCharaLiveStageDom,
  applyCharaLiveFrame,
  charaLiveStageCss,
  preloadCharaLiveImages
} from './charaLiveStage.js';

/** 相槌のあいづち文例。読み上げ内容に依存しない短い反応(AI 不要で常に動く土台)。 */
export const CHARA_BACKCHANNELS = Object.freeze([
  'うんうん',
  'なるほど〜',
  'たしかに',
  'わかる',
  'おお〜',
  'それな',
  'いいね！',
  'ふむふむ'
]);

/**
 * 自発発話の吹き出しを出しておく時間(ms)。
 * 読める長さ(短い1行を声に出して2秒 + 余韻)。長すぎると次が出せない。
 */
export const CHATTER_HOLD_MS = 4200;

/** 描画の目標 fps。18fps は venueBar の群衆アニメと同じ(会場を重くしない実績値)。 */
export const CHARA_LIVE_FPS = 18;

/** 描画の最小間隔(ms)。rAF が 60fps で来ても、これ未満の間隔では描き直さない。 */
export const FRAME_MIN_GAP_MS = Math.round(1000 / CHARA_LIVE_FPS);

/**
 * 相槌の間引き。全部のコメントに反応すると、コメントが速い放送で
 * 3 体が喋りっぱなしになり「ざわめき」でなく「うるさい」になる。
 * 直前の相槌からこの時間が経つまでは新しい相槌を出さない。
 */
export const REACTION_MIN_GAP_MS = 2600;

/**
 * キャラライブを起動する。
 *
 * @param {{
 *   doc: Document,
 *   mount?: HTMLElement|null,
 *   resolveUrl: (path: string) => string,
 *   now?: () => number,
 *   requestFrame?: (cb: FrameRequestCallback) => number,
 *   cancelFrame?: (id: number) => void,
 *   getHeatLevel?: () => number,
 *   reducedMotion?: boolean,
 *   backchannels?: readonly string[]
 * }} deps
 * @returns {{
 *   root: HTMLElement,
 *   preloadedImages: HTMLImageElement[],
 *   setVisible: (next: boolean) => void,
 *   onCommentSpoken: (input: { commentKey: string, text?: string }) => void,
 *   onCommentSpokenEnd: () => void,
 *   onStreamerAddressed: (input: { prompt: string, answer?: string, durationMs?: number, charaId?: string|null }) => string,
 *   beginThinking: (input?: { prompt?: string, charaId?: string|null }) => string,
 *   endThinking: (input?: { charaId?: string|null }) => string[],
 *   destroy: () => void
 * }}
 */
export function startCharaLive(deps) {
  const doc = deps.doc;
  const resolveUrl =
    typeof deps.resolveUrl === 'function' ? deps.resolveUrl : (/** @type {string} */ p) => p;
  const now = typeof deps.now === 'function' ? deps.now : () => Date.now();
  /*
   * ★フレーム駆動は rAF と setTimeout の【併用】(2026-09-04 実測で確定)。
   *
   *   経緯: 一度「軽くするため」に rAF 一本にした。ところが
   *   **rAF はタブが非アクティブだと完全に停止する**ため、実測すると
   *   浮遊も自発発話も止まっていた(transform が固定・40秒で1回しか喋らない)。
   *   配信で使う部品が「裏に回ると死ぬ」のは致命的:
   *     - 配信者は別ウィンドウ(ゲーム/OBS)を前面にしている時間の方が長い
   *     - OBS のブラウザソースも、条件によっては非可視扱いになりうる
   *
   *   ★だから: 見えている間は rAF(滑らかで軽い)、
   *     隠れている間は setTimeout(止まらない)に自動で切り替える。
   *   タイマー側は間隔を粗く(3倍)して、裏では CPU をほとんど使わない。
   *   ★「軽さ」と「止まらないこと」は両立できる。どちらかを捨てない。
   */
  const view = doc.defaultView;
  /** 裏に回っているときのフレーム間隔(ms)。粗くして CPU を食わせない。 */
  const HIDDEN_FRAME_MS = Math.round(1000 / CHARA_LIVE_FPS) * 3;

  /** いまページが隠れているか。 */
  const isHidden = () => {
    try {
      return doc.visibilityState === 'hidden';
    } catch {
      return false;
    }
  };

  /*
   * ★rAF と タイマーを【併走】させる（2026-09-04 実測で2度踏んだ末の結論）。
   *
   *   1度目の失敗: rAF 一本 → タブが隠れると完全停止。
   *   2度目の失敗: 「予約する時に isHidden() を見て分岐」→ **これでも止まった**。
   *     理由: 次フレームの予約は rAF のコールバックの中にある。
   *       ページが隠れた状態で開始（またはrAF予約直後に隠れる）と、
   *       **そのコールバックが永久に発火せず、分岐する機会そのものが来ない**。
   *       visibilitychange も、最初から hidden なら発火しないので救えない。
   *
   *   → 正解は「どちらが来るか予測して選ぶ」ではなく **両方仕掛けて先着を採る**。
   *     見えていれば rAF が先に来る（滑らか・軽い）。
   *     隠れていれば rAF は来ないのでタイマーが拾う（止まらない）。
   *     二重発火は once フラグで1回に潰す。
   */
  const raf =
    typeof deps.requestFrame === 'function'
      ? deps.requestFrame
      : (/** @type {FrameRequestCallback} */ cb) => {
          let fired = false;
          /** どちらか先に来た方だけを通す。 */
          const once = () => {
            if (fired) return;
            fired = true;
            cb(now());
          };
          // 保険のタイマー。隠れている時はこれだけが動く。
          // 見えている時も走るが、rAF が先に来るので once に弾かれる。
          const timerId = setTimeout(once, isHidden() ? HIDDEN_FRAME_MS : 250);
          let rafId = 0;
          if (typeof view?.requestAnimationFrame === 'function') {
            rafId = view.requestAnimationFrame(once);
          }
          // caf が両方止められるよう、ハンドルを1つにまとめて返す。
          return /** @type {any} */ ({ timerId, rafId });
        };
  const caf =
    typeof deps.cancelFrame === 'function'
      ? deps.cancelFrame
      : (/** @type {any} */ handle) => {
          if (!handle) return;
          try {
            if (handle.rafId && typeof view?.cancelAnimationFrame === 'function') {
              view.cancelAnimationFrame(handle.rafId);
            }
          } catch { /* no-op */ }
          try { clearTimeout(handle.timerId); } catch { /* no-op */ }
        };
  const getHeat = typeof deps.getHeatLevel === 'function' ? deps.getHeatLevel : () => 0;
  const backchannels =
    Array.isArray(deps.backchannels) && deps.backchannels.length
      ? deps.backchannels
      : CHARA_BACKCHANNELS;

  const reducedMotion =
    typeof deps.reducedMotion === 'boolean'
      ? deps.reducedMotion
      : typeof doc.defaultView?.matchMedia === 'function' &&
        doc.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches;


  // ---- CSS を 1 回だけ入れる ------------------------------------------------
  const STYLE_ID = 'nlcl-stage-style';
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = charaLiveStageCss();
    (doc.head || doc.documentElement).appendChild(style);
  }

  const { root, nodes } = buildCharaLiveStageDom(doc, resolveUrl);
  (deps.mount || doc.body || doc.documentElement).appendChild(root);

  // 表情差分を先読み(初回のちらつき防止)。
  // ★参照を捨てると GC でデコード結果ごと回収され、先読みの意味が消える。
  //   下の戻り値(preloadedImages)に載せて、呼び出し側が生かし続ける形にする。
  const preloadedImages = preloadCharaLiveImages(doc, resolveUrl);

  const state = makeInitialCharaLiveState();
  let lastReactionAt = -Infinity;
  // 会場を閉じている間は描かない(rAF を回し続けると閉じても CPU を食う)。
  let visible = true;
  // 描画の間引き用(最後に実際に描いた時刻)。
  let lastDrawMs = -Infinity;
  // 状態が変わった直後は間引きを1回だけ飛ばして即描く(反応の鈍さを出さない)。
  let needsImmediateDraw = false;
  /*
   * ★自発発話(2026-09-04): 視聴者0でも沈黙させないための状態。
   *   参照4コマの芯【視聴者0なのに、なんでこんなにうるさいのだ】は、
   *   外から入力が無くても場が途切れないことで初めて成立する。
   *   既存の onCommentSpoken/onStreamerAddressed は入力前提なので、
   *   それだけでは誰も来ない配信で一言も喋らない。
   */
  let chatterTurn = 0;
  /** @type {string|null} 直前に自発発話した子(連投回避)。 */
  let lastChatterSpeaker = null;
  let lastChatterAt = NaN;
  /** 外の出来事(読み上げ/呼びかけ)の最終時刻。直後は自発発話を譲る。 */
  let lastExternalAt = NaN;
  const startedAtMs = now();
  /** 自発発話を出すか(既定 ON。喋らせたくない用途は false にできる)。 */
  let chatterEnabled = deps.chatter !== false;
  /** 読み上げ中の相槌担当。onAudioEnd で黙らせるために覚えておく。 */
  let speakingChara = /** @type {import('./charaLiveState.js').CharaId|null} */ (null);
  let frameId = 0;
  let destroyed = false;

  // ---- 毎フレーム ----------------------------------------------------------
  const tick = () => {
    if (destroyed) return;
    // 非表示なら次のフレームを予約せずに抜ける(setVisible(true) が再開させる)。
    if (!visible) {
      frameId = 0;
      return;
    }
    const t = now();
    // ★rAF は毎秒60回来る。会場を重くしないため描画は約18fpsに間引く
    //   (群衆canvasと同じ方針)。間引いても浮遊は滑らかに見える。
    //   ただし相槌/返事/思考が入った直後だけは即座に描く(反応が鈍く見えないように)。
    if (!needsImmediateDraw && t - lastDrawMs < FRAME_MIN_GAP_MS) {
      frameId = raf(tick);
      return;
    }
    needsImmediateDraw = false;
    lastDrawMs = t;

    /*
     * ★自発発話。誰も来なくても、3人が勝手に喋り続ける。
     *   歯止めは charaChatter 側(最短間隔 / 人の発言直後は譲る)。
     *   既に何かのモード中(相槌/返事/思考)の子には重ねない = triggerCharaAnswer が
     *   空いている子を選ぶわけではないので、ここで idle の子だけを対象にする。
     */
    if (
      chatterEnabled &&
      shouldChatter({
        nowMs: t,
        lastChatterAtMs: lastChatterAt,
        lastExternalAtMs: lastExternalAt,
        turn: chatterTurn,
        // ★初回の間合いを測るのに開始時刻が要る(渡さないと永久に喋らない)。
        startedAtMs
      })
    ) {
      const line = buildChatterLine({
        nowMs: t,
        turn: chatterTurn,
        lastSpeaker: /** @type {any} */ (lastChatterSpeaker),
        lastExternalAtMs: lastExternalAt,
        startedAtMs
      });
      // ★自分から言うときは「答えを求めない」ものだけ(2026-09-04・Grokの助言)
      //   「稀に一言だけ・答えを求めない」。疑問形は相手に返事の義務を作る＝急かす。
      //   弾いた回は間隔だけ進めて次に回す(無理に別の台詞を探して喋らない)。
      // 選ばれた子が塞がっていたら今回は見送る(無理に割り込まない)。
      const slot = state.slots[line.charaId];
      if (slot && slot.mode === 'idle' && isSafeIdleLine(line.text)) {
        slot.mode = 'answer';
        slot.modeStartedAtMs = t;
        slot.untilMs = t + CHATTER_HOLD_MS;
        slot.text = line.text;
        state.lastSpeaker = line.charaId;
        lastChatterSpeaker = line.charaId;
        lastChatterAt = t;
        chatterTurn += 1;
      } else {
        // 塞がっていた場合も間隔だけ進めて、次のフレームで連打しない。
        lastChatterAt = t;
      }
    }

    expireCharaModes(state, t);
    const model = buildCharaLiveRenderModel(state, {
      timeMs: t,
      heatLevel: getHeat(),
      reducedMotion
    });
    applyCharaLiveFrame(nodes, model, resolveUrl);
    frameId = raf(tick);
  };
  frameId = raf(tick);

  /*
   * ★visibilitychange でループを張り直す（2026-09-04 実測で踏んだ致命傷）。
   *
   *   症状: LPを開いた直後にタブが隠れると、3人が【1回喋ったきり永久に止まる】。
   *   真因: 次フレームの予約は「rAFのコールバックの中」にある。
   *     表示中に開始すると1回目は requestAnimationFrame で予約されるが、
   *     その直後に隠れると **そのコールバックが永久に発火しない**。
   *     予約時にしか isHidden() を見ないので、一度この状態に入ると自力で戻れない。
   *   → 可視状態が変わった瞬間に、外から張り直す。これが唯一の復帰経路。
   */
  const onVisibilityChange = () => {
    if (destroyed || !visible) return;
    // 進行中の予約を捨てて、いまの可視状態に合った経路で取り直す。
    if (frameId) {
      try { caf(frameId); } catch { /* no-op */ }
    }
    frameId = raf(tick);
  };
  try {
    doc.addEventListener('visibilitychange', onVisibilityChange);
  } catch { /* 監視できなくても描画自体は続ける */ }

  return {
    root,
    /** 先読み画像。GC 回収を防ぐために参照を公開して保持する(見た目には使わない)。 */
    preloadedImages,

    /**
     * 自発発話の ON/OFF。
     * ★既定は ON(視聴者0でも沈黙させないのがこの部品の主目的)。
     *   読み上げ連動だけで使いたい用途のために切れるようにしてある。
     * @param {boolean} on
     */
    setChatter(on) {
      chatterEnabled = on !== false;
    },

    /**
     * 表示/非表示。会場を閉じている間は描画を止める(閉じても CPU を食い続けない)。
     * destroy と違い、再び true にすれば同じ状態から復帰する。
     * @param {boolean} next
     */
    setVisible(next) {
      const on = next !== false;
      if (on === visible) return;
      visible = on;
      root.hidden = !on;
      if (on && !frameId && !destroyed) {
        frameId = raf(tick);
      }
    },

    /**
     * コメントの読み上げが **実際に鳴り始めた** ときに呼ぶ(voicePlayer の onAudioStart)。
     * 3 体のうち 1 体が相槌を入れる。
     *
     * @param {{ commentKey: string, text?: string }} input
     */
    onCommentSpoken(input) {
      const t = now();
      // 間引き: 直前の相槌から十分空いていなければ黙っている(全部に反応しない)。
      if (t - lastReactionAt < REACTION_MIN_GAP_MS) return;
      const key = String(input?.commentKey ?? '');
      // 相槌の文面は commentKey で決定論的に選ぶ(同じコメントなら毎回同じ=テスト可能)。
      const idx = Math.abs(hashForPick(key)) % backchannels.length;
      const who = triggerCharaReaction(state, {
        commentKey: key,
        text: backchannels[idx],
        nowMs: t,
        // 読み上げが終わるまで相槌を出し続けたいので長めに取り、onAudioEnd で早めに畳む。
        durationMs: Math.max(REACT_MIN_MS, 6000)
      });
      if (who) {
        lastReactionAt = t;
        speakingChara = who;
        needsImmediateDraw = true;
      }
      // ★人(コメント)が喋った = 外の出来事。直後の自発発話を譲らせる。
      lastExternalAt = t;
    },

    /**
     * 読み上げが終わった/破棄されたときに呼ぶ(onAudioEnd / onDropped)。
     * 相槌を畳んで idle に戻す。声が止まっているのに口が動き続ける事故を防ぐ。
     */
    onCommentSpokenEnd() {
      if (!speakingChara) return;
      const slot = state.slots[speakingChara];
      // 返事(answer)や思考(thinking)に化けていたら触らない=別の意図を潰さない。
      if (slot && slot.mode === 'react') {
        slot.untilMs = now();
        needsImmediateDraw = true;
      }
      speakingChara = null;
    },

    /**
     * 配信者が「〇〇さん、〇〇だよね」と話しかけたときに呼ぶ。
     * 名指しがあればその子が、無ければ誰かが答える。
     *
     * @param {{ prompt: string, answer?: string, durationMs?: number }} input
     * @returns {string} 答える子の id
     */
    onStreamerAddressed(input) {
      needsImmediateDraw = true;
      // ★配信者が話しかけた = 外の出来事。かぶせて自分語りを始めない。
      lastExternalAt = now();
      return triggerCharaAnswer(state, {
        prompt: String(input?.prompt ?? ''),
        answer: String(input?.answer ?? ''),
        nowMs: now(),
        durationMs: input?.durationMs,
        // ★誰が答えるかを呼び出し側が指定できる。
        //   指定しないとここで選び直され、「表示された名前」と
        //   「実際に鳴る声」が食い違う（実害あり・2026-09-04）。
        charaId: input?.charaId ?? null
      });
    },

    /**
     * AI が考え始めたときに呼ぶ。返り値の id を endThinking に渡すと確実に閉じられる。
     * @param {{ prompt?: string, charaId?: string|null }} [input]
     * @returns {string}
     */
    beginThinking(input = {}) {
      needsImmediateDraw = true;
      return startCharaThinking(state, {
        nowMs: now(),
        prompt: input.prompt,
        charaId: /** @type {any} */ (input.charaId ?? null)
      });
    },

    /**
     * AI の思考が終わったときに呼ぶ。**必ず finally で呼ぶこと**
     * (例外で抜けると考え込んだまま固まる)。
     * @param {{ charaId?: string|null }} [input]
     * @returns {string[]}
     */
    endThinking(input = {}) {
      needsImmediateDraw = true;
      return endCharaThinking(state, {
        nowMs: now(),
        charaId: /** @type {any} */ (input.charaId ?? null)
      });
    },

    destroy() {
      destroyed = true;
      try { doc.removeEventListener('visibilitychange', onVisibilityChange); } catch { /* no-op */ }
      if (frameId) caf(frameId);
      frameId = 0;
      root.remove();
    }
  };
}

/**
 * 文字列→符号付き整数。相槌の文面選びにだけ使う軽いハッシュ。
 * @param {string} s
 * @returns {number}
 */
function hashForPick(s) {
  let h = 0;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i += 1) {
    h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  }
  return h;
}

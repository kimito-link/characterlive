/**
 * charaMotion.js — 状態ごとの動き（純関数）。
 *
 * ★方針（2026-09-04・ユーザー指示）
 *   「常時は反復移動だけ。棒立ち感を消す」
 *   「喋ってるキャラだけ大きな動きを出す。他の2人は控えめ」
 *   「常時回転や常時跳ねるは禁止。目障りになる」
 *   「3キャラが同時に派手に動くのは禁止。喋ってる1人だけ」
 *
 * ★グリッチ/砕け散るは**入れない**（ユーザー判断で保留）。
 *   3人がゆっくりで柔らかいことが毒舌を許す緩衝材になっている。
 *   画面が壊れる演出はその柔らかさを削る。まず呼吸と跳ねるを見てから決める。
 *
 * ★既存の resolveCharaFloat（常時の浮遊）は**触らない**。
 *   ここが返す値を**足し算で重ねる**。浮遊は既に3体が別位相で動いており、
 *   その仕組み（index等間隔＋ハッシュ微調整）は過去に実測で直したもの。壊さない。
 *
 * ★時刻から導く（フレーム数で数えない）。
 *   OBSは非表示シーンのブラウザソースを止める。フレームで数えると
 *   裏に回った瞬間にアニメが破綻する。時刻ならどこから再開しても連続する。
 */

/** @typedef {'idle'|'listening'|'thinking'|'speaking'} MotionState */

/** 跳ねる高さの上限(px)。★これ以上にすると画面がうるさくなる。 */
export const BOUNCE_MAX_PX = 7;
/** 呼吸の拡大率の振れ幅。★±3%まで。それ以上は「膨らんでいる」と見える。 */
export const BREATH_AMOUNT = 0.03;
/** 喋っているときの左右の揺れ(度)。 */
export const SPEAK_TILT_DEG = 2.4;

/**
 * 状態ごとの上乗せ分を返す。
 *
 * ★戻り値は「浮遊に足す差分」。絶対座標ではない。
 *
 * @param {{
 *   timeMs:number,
 *   state:MotionState,
 *   charaId:string,
 *   modeStartedAtMs?:number,
 *   reducedMotion?:boolean
 * }} input
 * @returns {{ dy:number, dTiltDeg:number, scaleMul:number }}
 */
export function resolveStateMotion(input) {
  const none = { dy: 0, dTiltDeg: 0, scaleMul: 1 };
  if (input.reducedMotion === true) return none;

  const t = Number(input.timeMs) || 0;
  const state = input.state;

  // ★聞いている / 何もしていない = 上乗せしない（浮遊だけ）。
  //   「控えめ」の一番確実な実装は**何も足さないこと**。
  if (state === 'idle' || state === 'listening') return none;

  if (state === 'thinking') {
    // ★考えている = 呼吸（反復拡大縮小）。跳ねない・回らない。
    //   人が考えるときは動きが小さくなる。大きく動かすと「焦っている」に見える。
    const breath = Math.sin((t / 1500) * Math.PI * 2);
    return { dy: breath * 1.5, dTiltDeg: 0, scaleMul: 1 + breath * BREATH_AMOUNT };
  }

  if (state === 'speaking') {
    // ★喋っている = 跳ねる + 左右の揺れ。
    //   跳ねは「上に跳ねて戻る」形にする（sinの絶対値）。下に沈むと不自然。
    const bouncePhase = (t / 620) * Math.PI * 2;
    const dy = -Math.abs(Math.sin(bouncePhase)) * BOUNCE_MAX_PX;
    // 左右の揺れは跳ねより遅い周期にする（同期すると機械的に見える）
    const dTiltDeg = Math.sin((t / 1100) * Math.PI * 2) * SPEAK_TILT_DEG;
    return { dy, dTiltDeg, scaleMul: 1 };
  }

  return none;
}

/**
 * ★たまに「ぴょこっ」と小さく跳ねて首をかしげる（1回の会話で1〜2回）。
 *
 *   もとは半回転（180度）していたが、ユーザー報告:「ひっくり返るアクションは不自然」（2026-11-25）。
 *   → 浮いている頭がひっくり返るのは不自然なので、**小さく跳ねて首をかしげ、ゆらゆら戻る**に置き換えた。
 *   ★常時は禁止。ここは**発話ごとに抽選**し、当たった発話でだけ動かす。
 *
 * ★乱数を使わない: 同じ発話で毎フレーム抽選し直すと動いたり戻ったりする。
 *   発話の開始時刻とキャラ名から決める（同じ発話中はずっと同じ判定）。
 *
 * @param {{ charaId:string, modeStartedAtMs:number, chance?:number }} input
 * @returns {boolean} この発話で動かすか
 */
export function shouldAccentThisTurn(input) {
  const started = Number(input.modeStartedAtMs);
  if (!Number.isFinite(started)) return false;
  const chance = Number.isFinite(input.chance) ? Number(input.chance) : 0.18;
  // 発話ごとに固定の 0..1（同じ発話中は変わらない）。シードは旧実装と同じにして頻度を変えない。
  const u = hashUnit(`spin:${input.charaId}:${Math.floor(started)}`);
  return u < chance;
}

/** ★かしげる角度の上限（度）。ひっくり返らない＝顔が読める範囲にとどめる。 */
export const ACCENT_TILT_MAX_DEG = 12;
/** ★ぴょこっと跳ねる高さ（px）。 */
export const ACCENT_HOP_PX = 9;

/**
 * 「ぴょこっ → 首かしげ → ゆらゆら戻る」を1回だけ返す。
 *   - 前半で上に小さく跳ねる（下には沈まない）
 *   - 首は片側にかしげ、減衰しながら反対側へ少し揺れて 0 に戻る
 *   - 終わったら完全に 0（傾いたまま残らない）
 *
 * @param {number} elapsedMs 発話が始まってからの経過
 * @param {{ durationMs?:number, direction?:1|-1 }} [opts] direction=かしげる向き
 * @returns {{ dy:number, tiltDeg:number }}
 */
export function accentMotion(elapsedMs, opts = {}) {
  const durationMs = Number.isFinite(opts.durationMs) ? Number(opts.durationMs) : 1100;
  const dir = opts.direction === -1 ? -1 : 1;
  const e = Number(elapsedMs) || 0;
  if (e <= 0 || e >= durationMs) return { dy: 0, tiltDeg: 0 };
  const p = e / durationMs; // 0..1

  // 跳ね: 前半35%で上がって戻る（sinの半周期）。
  const hopP = p / 0.35;
  const dy = hopP < 1 ? -Math.sin(hopP * Math.PI) * ACCENT_HOP_PX : 0;

  // 首かしげ: 減衰する揺れ（1.5往復）。端で 0、途中で最大 ACCENT_TILT_MAX_DEG 未満。
  const envelope = (1 - p) * (1 - p);
  const tiltDeg = dir * Math.sin(p * Math.PI * 3) * ACCENT_TILT_MAX_DEG * envelope * 1.4;
  const clamped = Math.max(-ACCENT_TILT_MAX_DEG, Math.min(ACCENT_TILT_MAX_DEG, tiltDeg));
  return { dy, tiltDeg: clamped };
}

/** かしげる向きをキャラごとに固定する（3人が同じ向きにならないように）。 */
export function accentDirection(charaId) {
  return hashUnit(`accent-dir:${charaId}`) < 0.5 ? -1 : 1;
}

/** FNV-1a。決定論にするため（Math.random を使わない）。 */
function hashUnit(seed) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000;
}

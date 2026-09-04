/**
 * charaMicLevel.js — マイクの音量を測る（本当に拾えているかを見せるため）。
 *
 * ★なぜ要るか（2026-09-04・ユーザー指摘）
 *   ユーザーの言葉:「これみるとスピーカーゲージがないのでほんとうにつかえてるかわかりずらい」
 *   → ★点が赤く光るだけでは「聞いている**つもり**」なのか
 *     「本当に音が入っている」のかが区別できない。
 *     Grokの入力欄には音に反応して動く波形がある。あれが安心の正体。
 *
 * ★重要: これは音声認識(SpeechRecognition)とは**別の経路**。
 *   認識APIは音量を教えてくれないので、getUserMedia + AnalyserNode で別に測る。
 *   ★つまり「波が動くのに文字にならない」場合、マイクは生きていて認識だけが
 *     失敗していると切り分けられる。★不具合の切り分けにそのまま使える。
 */

/**
 * マイクの音量を測り続ける。
 *
 * @param {{ onLevel:(level:number)=>void, onError?:(reason:string)=>void }} opts
 *   onLevel は 0..1（1に近いほど大きい音）
 * @returns {Promise<{stop:()=>void}|null>}
 */
export async function startMicLevel(opts) {
  if (!navigator.mediaDevices?.getUserMedia) {
    opts.onError?.('この環境ではマイクが使えません');
    return null;
  }

  /** @type {MediaStream|null} */ let stream = null;
  /** @type {AudioContext|null} */ let ctx = null;
  let raf = 0;
  let alive = true;

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // ★配信環境では自分のスピーカー音が回り込む。ブラウザ側の対策を有効にする。
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
  } catch (e) {
    const name = String(e?.name || '');
    opts.onError?.(
      name === 'NotAllowedError'
        ? 'マイクの使用が許可されていません'
        : `マイクを開けません（${name || e}）`
    );
    return null;
  }

  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  ctx = new AC();
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  // ★小さめにして応答を速くする（見た目の追従が遅いと「効いていない」ように見える）
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.6;
  src.connect(analyser);

  const buf = new Uint8Array(analyser.fftSize);

  const tick = () => {
    if (!alive) return;
    analyser.getByteTimeDomainData(buf);
    // ★RMS(実効値)で測る。ピークだと単発のノイズで振り切れて役に立たない。
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    opts.onLevel(normalizeLevel(rms));
    raf = requestAnimationFrame(tick);
  };
  tick();

  return {
    stop() {
      alive = false;
      cancelAnimationFrame(raf);
      try { stream?.getTracks().forEach((t) => t.stop()); } catch { /* no-op */ }
      try { ctx?.close(); } catch { /* no-op */ }
    }
  };
}

/**
 * RMS を見た目に使える 0..1 に直す（純関数）。
 *
 * ★そのまま使うと**ほとんど動かない**。話し声の RMS は 0.02〜0.15 程度で、
 *   0..1 にそのまま当てると棒がぴくりとも動かず「壊れている」と見える。
 *   → 話し声の範囲を引き伸ばす。
 *
 * @param {number} rms
 * @returns {number} 0..1
 */
export function normalizeLevel(rms) {
  const v = Number(rms);
  if (!Number.isFinite(v) || v <= 0) return 0;
  // 0.005(ほぼ無音) 〜 0.20(大きめの声) を 0..1 に写す
  const lo = 0.005;
  const hi = 0.20;
  const t = (v - lo) / (hi - lo);
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  // ★平方根で持ち上げる。小さい声でも見た目が動く方が「拾えている」と分かる。
  return Math.sqrt(t);
}

/**
 * マイクの許可状態を調べる（押す前に分かるようにするため）。
 *
 * ★なぜ必要か（2026-09-04・ユーザー指摘）
 *   ユーザーが示したのは Chrome のサイト情報パネルの「マイク / 現在使用中」表示。
 *   ★あれは**ブラウザが出すもので、ページからは作れない**。
 *   しかし「いま使えるのか」が一目で分かるという安心感は、ページ側でも作れる。
 *   → 押す前から状態を出しておく。押して初めて分かる、では遅い。
 *
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 */
export async function micPermission() {
  try {
    const st = await navigator.permissions?.query({ name: /** @type {any} */ ('microphone') });
    const s = String(st?.state || '');
    if (s === 'granted' || s === 'denied' || s === 'prompt') return s;
    return 'unknown';
  } catch {
    // ★Firefox等は microphone の query に対応していない。使えないのは普通のこと。
    return 'unknown';
  }
}

/**
 * 許可状態の変化を監視する（設定を変えたら画面に反映するため）。
 * @param {(state:string)=>void} onChange
 * @returns {Promise<{stop:()=>void}|null>}
 */
export async function watchMicPermission(onChange) {
  try {
    const st = await navigator.permissions?.query({ name: /** @type {any} */ ('microphone') });
    if (!st) return null;
    const h = () => onChange(String(st.state));
    st.addEventListener('change', h);
    return { stop() { try { st.removeEventListener('change', h); } catch { /* no-op */ } } };
  } catch {
    return null;
  }
}

/**
 * 許可状態を人間の言葉にする（純関数）。
 * ★「denied」と出しても何をすればいいか分からない。**直し方まで書く。**
 * @param {string} state
 */
export function describeMicPermission(state) {
  switch (state) {
    case 'granted':
      return { ok: true, label: 'マイク使用可', hint: '' };
    case 'denied':
      return {
        ok: false,
        label: 'マイクが拒否されています',
        hint: 'アドレスバー左の🔒→マイク→許可 に変えてください'
      };
    case 'prompt':
      return { ok: true, label: 'マイク未許可（押すと確認されます）', hint: '' };
    default:
      return { ok: true, label: 'マイク状態は不明（押すと分かります）', hint: '' };
  }
}

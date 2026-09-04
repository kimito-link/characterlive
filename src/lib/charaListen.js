/**
 * charaListen.js — マイクで聞く（Web Speech API）。
 *
 * ★なぜ要るか（2026-09-04・ユーザー指摘）
 *   ユーザーの言葉:「おんせいをいれられるUIになってないからやるきしない」
 *   → ★**文字を打つ画面では「話しかける」体験にならない。**
 *     企画の本命は「ずっとスピーカーがついてて話せる」だった。入口が無ければ始まらない。
 *
 * ★移植元の知見: tsuioku-no-kirameki.com/src/extension/content-entry.js:1057-1097
 *   ★**Web Speech API は勝手に止まる**（無音が続くと60秒ほどで onend）。
 *     止まったまま放置すると「反応しなくなった」に見える。**必ず再起動する。**
 *   ★ただし無限再起動は禁物。エラーが続くときは諦めて画面に出す
 *     （マイクが無い・許可されていない場合、再起動を繰り返すと重くなるだけ）。
 *
 * ★自分の声で誤爆しない（エコー対策・調査でバージイン誤検出の89%が自分の声と背景ノイズ）
 *   3人が喋っている間の認識結果は捨てる。マイクとスピーカーが同室の配信環境では必須。
 *   → mute()/unmute() を再生側から呼ぶ。
 *   ★Grok本人に確認(2026-09-04):「誤爆は再生中にマイクをミュートするのが一番確実」
 *
 * ★★既定は「押して話す」にする（2026-09-04・Grok本人に音声で相談して方針転換）
 *   私は「ずっとスピーカーがついてて話せる」を本命だと考えていたが、
 *   ★配信環境では逆だと指摘された。Grokの回答:
 *     「常時オンは配信には向かない。ゲーム音やBGM、独り言を全部拾って、
 *       3人が同時に反応してカオスになる」
 *     「プッシュトゥトークを既定にする。配信者は配信中ずっとボタンを握ってる
 *       わけにもいかないから、ショートカットキーでオンオフ、あるいは
 *       『りんく』みたいなウェイクワードで起動、が現実的」
 *   → ★押している間だけ聞く(holdToTalk)。ボタンを離したら止める。
 *     常時オンも選べるようにはするが、**既定にはしない**。
 */

/** @typedef {{ final:boolean, text:string }} Heard */

/**
 * 使えるかどうか（例外にしない。使えないのは普通のこと）。
 * @returns {{ok:boolean, reason?:string}}
 */
export function canListen() {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) return { ok: false, reason: 'このブラウザは音声入力に対応していません' };
  if (!globalThis.isSecureContext) {
    return { ok: false, reason: 'httpsかlocalhostで開いてください（マイクが使えません）' };
  }
  return { ok: true };
}

/**
 * 聞き続ける。
 *
 * @param {{
 *   onHeard:(h:Heard)=>void,
 *   onState?:(s:'listening'|'stopped'|'error')=>void,
 *   onError?:(reason:string)=>void,
 *   lang?:string
 * }} opts
 */
export function startListening(opts) {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = opts.lang || 'ja-JP';
  rec.continuous = true;
  // ★途中経過を受け取る。人は聞きながら次を考えるので、終わりを待つと間に合わない
  //   （Levinson: 隙間200msなのに発話の計画に600ms要る）。
  rec.interimResults = true;

  let alive = true;
  let muted = false;
  /** ★連続エラーが続いたら諦める（無限再起動でCPUを食わない） */
  let consecutiveErrors = 0;
  let restartTimer = null;

  rec.onresult = (ev) => {
    // ★自分たちが喋っている間は聞かない（自分の声で誤爆しない）
    if (muted) return;
    for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
      const r = ev.results[i];
      const text = String(r[0]?.transcript || '').trim();
      if (!text) continue;
      opts.onHeard({ final: !!r.isFinal, text });
    }
  };

  rec.onerror = (ev) => {
    const err = String(ev?.error || 'unknown');
    // ★'no-speech' と 'aborted' は異常ではない（黙っていただけ）。数えない。
    if (err === 'no-speech' || err === 'aborted') return;
    consecutiveErrors += 1;
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      alive = false;
      opts.onError?.('マイクの使用が許可されていません');
      opts.onState?.('error');
      return;
    }
    if (consecutiveErrors >= 5) {
      alive = false;
      opts.onError?.(`音声入力が続けられません（${err}）`);
      opts.onState?.('error');
    }
  };

  rec.onstart = () => {
    consecutiveErrors = 0;
    opts.onState?.('listening');
  };

  // ★これが本体。勝手に止まるので必ず起こし直す。
  rec.onend = () => {
    if (!alive) { opts.onState?.('stopped'); return; }
    clearTimeout(restartTimer);
    // 即座に再起動すると失敗しやすいので少し置く
    restartTimer = setTimeout(() => {
      if (!alive) return;
      try { rec.start(); } catch { /* 二重startは無視（既に動いている） */ }
    }, 400);
  };

  try {
    rec.start();
  } catch (e) {
    alive = false;
    opts.onError?.(String(e?.message || e));
    opts.onState?.('error');
  }

  return {
    /** ★3人が喋る前に呼ぶ。再生中の認識結果を捨てる（エコー対策）。 */
    mute() { muted = true; },
    unmute() { muted = false; },
    stop() {
      alive = false;
      clearTimeout(restartTimer);
      try { rec.stop(); } catch { /* no-op */ }
      opts.onState?.('stopped');
    },
    get isMuted() { return muted; }
  };
}

/**
 * ★押している間だけ聞く（プッシュトゥトーク）。**これを既定にする。**
 *
 *   Grok本人の助言(2026-09-04):「常時オンは配信には向かない。
 *   ゲーム音やBGM、独り言を全部拾って、3人が同時に反応してカオスになる」
 *
 *   startListening との違いは「勝手に再起動しない」こと。
 *   押している間だけなので、止まったら止まったままでよい（起こし直すと押していないのに聞く）。
 *
 * @param {{
 *   onHeard:(h:Heard)=>void,
 *   onState?:(s:'listening'|'stopped'|'error')=>void,
 *   onError?:(reason:string)=>void,
 *   lang?:string
 * }} opts
 */
export function createPushToTalk(opts) {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR) return null;

  /** @type {any} */ let rec = null;
  let holding = false;

  return {
    /** ボタンを押した/キーを押した瞬間 */
    begin() {
      if (holding) return;
      holding = true;
      rec = new SR();
      rec.lang = opts.lang || 'ja-JP';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (ev) => {
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          const r = ev.results[i];
          const text = String(r[0]?.transcript || '').trim();
          if (text) opts.onHeard({ final: !!r.isFinal, text });
        }
      };
      rec.onerror = (ev) => {
        const err = String(ev?.error || '');
        // ★押している間の 'no-speech' は異常ではない（黙って押していただけ）
        if (err === 'no-speech' || err === 'aborted') return;
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          opts.onError?.('マイクの使用が許可されていません');
        } else {
          opts.onError?.(`音声入力に失敗しました（${err}）`);
        }
        opts.onState?.('error');
      };
      rec.onstart = () => opts.onState?.('listening');
      rec.onend = () => { opts.onState?.('stopped'); rec = null; };
      try { rec.start(); } catch (e) {
        holding = false;
        opts.onError?.(String(e?.message || e));
        opts.onState?.('error');
      }
    },

    /** 離した瞬間。★ここで止める（押していないのに聞き続けない） */
    end() {
      if (!holding) return;
      holding = false;
      try { rec?.stop(); } catch { /* no-op */ }
    },

    get isHolding() { return holding; }
  };
}

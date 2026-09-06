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
/**
 * ★端末内で音声認識できるか調べる（2026-09-06・調査で判明した最大の収穫）
 *
 *   ★実は「全部ローカル」が成立していなかった。
 *     従来の webkitSpeechRecognition は**音声をGoogleのサーバーへ送っている**。
 *     この製品は「返答も音声合成もローカル」と言いながら、
 *     ★聞いた声だけ外に出ていた。
 *
 *   Chrome 139（2025年8月）で on-device Web Speech API が出荷され、
 *   日本語(ja-JP)も対応した。これを使えば本当にローカルになる。
 *
 *   ★もう1つの利点: quality を指定できる。
 *     既定は 'command'（短い孤立フレーズ想定）。★会話には 'dictation' が適切で、
 *     認識精度が変わる可能性がある。
 *
 *   ★macOS に既知の不具合があるため、使えなければ黙って従来方式に戻す
 *     （使えないことは異常ではない）。
 *
 * @returns {Promise<{ok:boolean, state:string, reason?:string}>}
 */
export async function probeLocalRecognition() {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR?.available) {
    return { ok: false, state: 'unsupported', reason: 'このChromeは端末内認識に未対応' };
  }
  try {
    const state = await SR.available({
      langs: ['ja-JP'], processLocally: true, quality: 'dictation'
    });
    if (state === 'available') return { ok: true, state };
    return { ok: false, state, reason: `端末内認識は ${state}` };
  } catch (e) {
    return { ok: false, state: 'error', reason: String(e?.message || e) };
  }
}

/**
 * ★端末内認識のモデルを取得する。**クリックの中から呼ぶこと**。
 *   （内蔵AIと同じく、ユーザー操作が要る可能性がある）
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function installLocalRecognition() {
  const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!SR?.install) return { ok: false, reason: 'この環境では取得できません' };
  try {
    const ok = await SR.install({ langs: ['ja-JP'], processLocally: true });
    return { ok: !!ok };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e) };
  }
}

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
  applyLocalMode(rec, opts);
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
  /* ★キャラが喋っている間は聞かない（2026-09-06・実害）
     ユーザー報告:「キャラ喋った声が入力されてる」
     ★mute/unmute は常時オン版(startListening)にはあったが、
       **PTT版には実装されていなかった**。しかも talk.html から一度も
       呼ばれていなかった（実測0件）。
     ★マイクとスピーカーが同じ部屋にある以上、これは必ず起きる。
       調査でも「バージイン検出の89%が誤検出で、原因は自分の声の回り込み」。 */
  let muted = false;

  return {
    /** ボタンを押した/キーを押した瞬間 */
    begin() {
      if (holding) return;
      holding = true;
      rec = new SR();
      rec.lang = opts.lang || 'ja-JP';
      rec.continuous = true;
      applyLocalMode(rec, opts);
      rec.interimResults = true;
      rec.onresult = (ev) => {
        // ★キャラが喋っている間の認識結果は捨てる（自分の声で誤爆しない）
        if (muted) return;
        for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
          const r = ev.results[i];
          const text = String(r[0]?.transcript || '').trim();
          if (text) opts.onHeard({ final: !!r.isFinal, text });
        }
      };
      rec.onerror = (ev) => {
        const err = String(ev?.error || '');
        // ★押している間の 'no-speech' は異常ではない（黙って押していただけ）
        /* ★聞き取れなかったことは伝える（2026-09-05・実害）
           ユーザー報告:「いくら喋っても、自分のログがチャットに出ないことがある」
           ★no-speech を黙って捨てていたため、
             話したのに何も起きない＝壊れているように見えていた。 */
        if (err === 'no-speech') {
          opts.onError?.('聞き取れませんでした。もう一度どうぞ');
          return;
        }
        if (err === 'aborted') return;   // 自分で止めたときなので異常ではない
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          opts.onError?.('マイクの使用が許可されていません');
        } else {
          opts.onError?.(`音声入力に失敗しました（${err}）`);
        }
        opts.onState?.('error');
      };
      rec.onstart = () => opts.onState?.('listening');
      /* ★押している間は onend で必ず再起動する（2026-09-06・実害の主因）

         ユーザー報告:「しゃべっても今ログが反映されなくなってる」

         ★真因: Chrome は**押しっぱなしでも無音が続くと onend を発火する**。
           ここで再起動していなかったため、一度黙るとマイクが死に、
           「押しているのに聞いていない」状態のまま戻らなかった。

         ★常時オン版(startListening)には同じ再起動ロジックが既にある。
           PTT版にだけ無かった。「押していないのに聞き続けない」ことを
           優先しすぎて、**押している間に止まる**方を見落としていた。 */
      rec.onend = () => {
        if (!holding) { opts.onState?.('stopped'); rec = null; return; }
        // ★即座に start() すると失敗しやすいので少し置く（常時オン版と同じ）
        setTimeout(() => {
          if (!holding) return;
          try { rec?.start(); } catch { /* 二重startは無視（既に動いている） */ }
        }, 400);
      };
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

    /** ★キャラが喋る前に呼ぶ。再生中の認識結果を捨てる。 */
    mute() { muted = true; },
    /** ★キャラが喋り終わったら呼ぶ。 */
    unmute() { muted = false; },
    get isMuted() { return muted; },

    get isHolding() { return holding; }
  };
}

/**
 * ★端末内処理を有効にする（使えるときだけ）。
 *
 *   ★呼び出し側が preferLocal:true を渡し、かつ probeLocalRecognition が
 *     'available' を返していたときだけ設定する。
 *   ★闇雲に true にすると、未対応環境で認識が始まらなくなる。
 *
 * @param {any} rec
 * @param {{ preferLocal?:boolean }} opts
 */
function applyLocalMode(rec, opts = {}) {
  if (!opts.preferLocal) return;
  try {
    rec.processLocally = true;
  } catch { /* 未対応なら黙って従来方式（サーバー処理）で動く */ }
}

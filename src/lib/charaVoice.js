/**
 * charaVoice.js — VOICEVOX で3人の声を鳴らす（ブラウザから直接）。
 *
 * ★移植元: tsuioku-no-kirameki.com/src/lib/voicevoxClient.js
 *   拡張機能用のプロキシ経路は要らないので削り、ブラウザから直接叩く形に絞った。
 *
 * ★実測で確認済み（2026-09-04・この環境）
 *   - `http://localhost:5173` から `http://127.0.0.1:50021` は **呼べる**
 *     （VOICEVOX 側が access-control-allow-origin を返す。CORS も通る）
 *   - ★ただし **https のページからは呼べない**（mixed content）。ローカルで開くこと。
 *   - 合成の実測: 相槌「うんうん」213ms / 短い返事 298ms / 通常26字 900ms
 *
 * ★16kHz にすると合成が約30%速くなる（移植元のコメントに実測値あり。1465→1025ms）。
 *   声で会話する以上、速さは体感に直結するので必ず適用する。
 */

export const VOICEVOX_BASE = 'http://127.0.0.1:50021';

/** ★16kで合成が約30%速い。それ以下は速くならず音質だけ落ちる（移植元の実測）。 */
export const OUTPUT_SAMPLING_RATE = 16000;

/**
 * VOICEVOX が起動しているか。
 * ★起動していないのは**普通のこと**なので、例外にせず false を返す。
 *   画面側は「声なしでも壊れない」ように作る。
 * @returns {Promise<boolean>}
 */
export async function isVoicevoxAlive({ timeoutMs = 1500 } = {}) {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    const res = await fetch(`${VOICEVOX_BASE}/version`, { signal: ac.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 話者一覧（styleId を選ばせるため）。
 * ★Grok が「音声」を性格と独立して選ばせているのと同じことをやる。
 * @returns {Promise<Array<{name:string, styles:Array<{name:string,id:number}>}>>}
 */
export async function listSpeakers() {
  const res = await fetch(`${VOICEVOX_BASE}/speakers`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * テキストを音声にする。
 *
 * ★2回叩く必要がある（VOICEVOX の仕様）:
 *   1. POST /audio_query  … 読み・アクセントを解析した JSON をもらう
 *   2. POST /synthesis    … その JSON を渡して WAV をもらう
 *   間で JSON をいじると、速さ・高さを変えられる。
 *
 * @param {string} text
 * @param {{ styleId:number, speedOffset?:number, pitchOffset?:number, signal?:AbortSignal }} voice
 * @returns {Promise<ArrayBuffer|null>} 失敗したら null（例外にしない＝声が出なくても会話は続ける）
 */
export async function synthesize(text, voice) {
  const t = String(text || '').trim();
  if (!t) return null;
  const styleId = Number(voice?.styleId ?? 3);

  try {
    const q = await fetch(
      `${VOICEVOX_BASE}/audio_query?text=${encodeURIComponent(t)}&speaker=${styleId}`,
      { method: 'POST', signal: voice?.signal }
    );
    if (!q.ok) return null;
    const audioQuery = await q.json();

    // ★ここで速さ・高さを調整できる
    audioQuery.speedScale = (Number(audioQuery.speedScale) || 1) + (voice?.speedOffset || 0);
    audioQuery.pitchScale = (Number(audioQuery.pitchScale) || 0) + (voice?.pitchOffset || 0);
    // ★16kHz・モノラルで合成を速くする（実測30%短縮）
    audioQuery.outputSamplingRate = OUTPUT_SAMPLING_RATE;
    audioQuery.outputStereo = false;
    // 前後の無音を削る（会話のテンポに効く）
    audioQuery.prePhonemeLength = 0.02;
    audioQuery.postPhonemeLength = 0.06;

    const s = await fetch(`${VOICEVOX_BASE}/synthesis?speaker=${styleId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audioQuery),
      signal: voice?.signal
    });
    if (!s.ok) return null;
    return await s.arrayBuffer();
  } catch {
    // ★VOICEVOX が落ちていても会話は止めない
    return null;
  }
}

/**
 * 音声を鳴らす。**鳴り始め/鳴り終わりを通知する**。
 *
 * ★この通知が口パクの正体。
 *   移植元では「コメント到着」ではなく「実際に音が鳴った瞬間」に口を動かしていた。
 *   到着時に動かすと、合成が詰まっているときに **声より先に口が動く**（露骨に嘘くさい）。
 *
 * @param {ArrayBuffer} wav
 * @param {{ onStart?:()=>void, onEnd?:()=>void }} [cb]
 * @returns {{ stop:()=>void, done:Promise<void> }}
 */
export function playWav(wav, cb = {}) {
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  let settled = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    URL.revokeObjectURL(url);
    cb.onEnd?.();
  };

  const done = new Promise((resolve) => {
    audio.addEventListener('ended', () => { finish(); resolve(); });
    audio.addEventListener('error', () => { finish(); resolve(); });
    // ★保険: ended も error も来ないことがある（タブが裏に回った等）
    setTimeout(() => { finish(); resolve(); }, 20000);
  });

  audio.play().then(() => cb.onStart?.()).catch(() => finish());

  return {
    stop() {
      try { audio.pause(); } catch { /* no-op */ }
      finish();
    },
    done
  };
}

/**
 * charaCloudRequest.js — クラウド頭脳（Claude Fable 5.1）へ送る依頼を組み立てる純関数。
 *
 * ★なぜ別ファイルか
 *   ブラウザ側(charaBrain.js)とサーバ側(api/chat.js)の両方が同じ知識を使う。
 *   ここは **鍵もSDKも触らない**。組み立てと読み取りだけなので、そのままテストできる。
 *
 * ★内蔵AI（Gemini Nano）との違い（2026-09-07）
 *   - system の上限 250字という縛りが無い → 音声認識の崩れへの指示を足せる
 *   - 履歴を 1件28字×10ターン に切る必要が無い → 文脈を持てる
 *   ★「文脈を持っていない」が真因（_docs/NEXT-SESSION.md）。ここがその対策の芯。
 */

/** 使うモデル。★Fable 5.1 は thinking が常時オンなので thinking パラメータは送らない。 */
export const CLOUD_MODEL = 'claude-fable-5-1';

/**
 * 返事は1〜3文（48字）に切るので、出力は短くてよい。
 * ★ただし Fable は思考トークンも max_tokens に含むため、見た目の返事より余裕を持たせる。
 */
export const CLOUD_MAX_TOKENS = 1024;

/**
 * 会話は速さ優先。★effort は思考の深さ＝待ち時間。
 * 雑談向けは low が最も速く、Grok の「速いから相槌が要らない」に近づける。
 */
export const CLOUD_EFFORT = 'low';

/** 安全分類器が断ったとき、同じ依頼を別モデルで続けるためのベータ。 */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/**
 * ★クラウド頭脳だけに足す system の追記。
 *   Grok が同じ劣化した音で意図を復元できていた理由を、言葉で指示する
 *   （_docs/NEXT-SESSION.md「3. プロンプトで明示する」）。
 *   ★内蔵AIには入れない（250字上限を超えて create が失敗する）。
 */
export const CLOUD_SYSTEM_EXTRA = [
  '相手の言葉は音声認識の書き起こしで、崩れていることがある。',
  '意味の通らない部分は無視し、前後の会話から相手の意図を汲んで答える。',
  '相手の言葉をそのまま繰り返さない。'
].join('');

/** クラウド頭脳に渡す履歴の量。★内蔵AIの 10ターン×28字 より大きく取る。 */
export const CLOUD_HISTORY_TURNS = 30;
export const CLOUD_HISTORY_CHARS = 200;

/**
 * Messages API へ送る本文を組み立てる。
 * @param {{ system:string, user:string }} input
 */
export function buildCloudRequest(input) {
  const system = String(input?.system || '').trim();
  const user = String(input?.user || '').trim();
  if (!system) throw new Error('system が空です');
  if (!user) throw new Error('user が空です');
  return {
    model: CLOUD_MODEL,
    max_tokens: CLOUD_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort: CLOUD_EFFORT },
    // ★断られたら別モデルで同じ依頼を続ける（分類ごとの既定ルート）
    fallbacks: 'default',
    betas: [FALLBACK_BETA]
  };
}

/**
 * API の応答から返事の文だけを取り出す。
 * ★stop_reason を先に見る。refusal のときは content を読まない。
 * @param {any} response
 * @returns {{ ok:boolean, text?:string, reason?:string, servedBy?:string }}
 */
export function readCloudReply(response) {
  if (!response || typeof response !== 'object') return { ok: false, reason: '応答が空です' };
  const servedBy = typeof response.model === 'string' ? response.model : undefined;
  if (response.stop_reason === 'refusal') {
    const cat = response.stop_details?.category || 'unknown';
    return { ok: false, reason: `AIが返事を断りました（${cat}）`, servedBy };
  }
  const text = (Array.isArray(response.content) ? response.content : [])
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) return { ok: false, reason: '返事の本文がありません', servedBy };
  return { ok: true, text, servedBy };
}

/**
 * chatCostGuard.js — /api/chat（Claude Fable 5.1）を「呼ぶ前に」止める守り。サーバ側専用。
 *
 * ★正本: ai-generic-rules/docs/policies/COST_SAFETY_POLICY.md（§3 L1・L2・L4・L6）。
 *   見本: kimitolink-linktree/lib/server/ouen/budget.ts の reserveMilli（同じ形で写している）。
 *
 * ★なぜ要るか（2026-10-19）
 *   /api/chat は匿名で叩ける。鍵（ANTHROPIC_API_KEY）を入れた瞬間に、誰でも Fable を
 *   自由な本文で呼べてしまう。本番は今まだ鍵が無い（GET /api/chat が hasKey:false）ので
 *   燃えていないが、鍵を入れる前にこの守りを付ける。
 *
 * ★4つの層（呼ぶ前に上から順に見る）
 *   L1 キルスイッチ … 環境変数 PAID_CALLS_DISABLED=1 で全部止まる（デプロイ不要）
 *   L4 IP ごとの上限 … 1日あたりの回数。カウンタに繋がらなければ通さない
 *   L2 日次予算の予約 … 見積り額を INCRBY で先に積み、超えたら戻して呼ばない
 *   L6 見せ方      … 止めたときは「本日の会話枠は終了」と正直に言う
 *
 * ★fail-closed: カウンタ（Vercel KV / Upstash Redis）が無い・繋がらない・上限の env が
 *   数値として読めない → 呼ばない。「数えられないなら使わない」。
 *
 * ★見積りと上限は同じ定数から導く（budget.ts の教訓。別々に置くと「必ず拒否」になる）。
 *
 * ★ブラウザからは import しない（api/chat.js と scripts/serve-demo.mjs だけが使う）。
 */
import { CLOUD_MAX_TOKENS } from './charaCloudRequest.js';

// ─────────────────────────────────────────────
// 原価（見積り）
// ─────────────────────────────────────────────

/** Claude Fable 5.1 の単価（$/1M トークン）。2026-10 時点の公表値。 */
export const PRICE_INPUT_PER_MTOK = 10;
export const PRICE_OUTPUT_PER_MTOK = 50;

/**
 * 1文字あたりのトークン数の上限見積り。
 * ★日本語は概ね 1字≒1トークン前後。予約は「多めに数える側」に倒すので 2 にしておく。
 */
export const TOKENS_PER_CHAR_UPPER = 2;

/**
 * user 本文の上限（字）。
 * ★charaBrain.js のクラウド頭脳は履歴 30ターン×200字（CLOUD_HISTORY_*）＋指示を畳んで送る。
 *   それが入りきる大きさにして、それ以上は受け取らない（汎用の Claude 代理にさせない）。
 */
export const USER_MAX_CHARS = 8000;

/** system の上限見積り（字）。system はサーバで組み立てるので実長を使うが、最大見積りにも使う。 */
export const SYSTEM_MAX_CHARS_ESTIMATE = 1500;

/**
 * 1回の呼び出しの見積り（ミリドル＝1/1000ドル。切り上げ）。
 * ★出力は max_tokens ぶん全部使ったものとして数える（思考トークンも出力に含まれるため）。
 */
export function estimateCallMilli(systemChars, userChars) {
  const inTok = (Math.max(0, systemChars) + Math.max(0, userChars)) * TOKENS_PER_CHAR_UPPER;
  const outTok = CLOUD_MAX_TOKENS;
  const dollars = (inTok * PRICE_INPUT_PER_MTOK + outTok * PRICE_OUTPUT_PER_MTOK) / 1_000_000;
  return Math.ceil(dollars * 1000);
}

/** 1回の最大見積り（user も system も上限いっぱい）。 */
export const MAX_CALL_MILLI = estimateCallMilli(SYSTEM_MAX_CHARS_ESTIMATE, USER_MAX_CHARS);

/**
 * 匿名の全体予算の既定（ミリドル/日）。
 * ★最大見積りの倍数で決める（上限 < 1回の見積り で「必ず拒否」にならないように）。
 *   最大見積り 1回 ≈ $0.26 → 12回分 ≈ $3.1/日（約470円/日）。数字は提案（docs/COST-MODEL.md）。
 */
export const DEFAULT_DAILY_CALLS_AT_MAX = 12;
export const DEFAULT_DAILY_BUDGET_MILLI = MAX_CALL_MILLI * DEFAULT_DAILY_CALLS_AT_MAX;

/** IP ごとの1日の回数上限の既定。 */
export const DEFAULT_IP_DAILY_CALLS = 20;

/** カウンタの保持日数（見直しで実データを読むため）。 */
export const COUNTER_TTL_SEC = 14 * 24 * 60 * 60;

// ─────────────────────────────────────────────
// env の読み取り（★読めなければ null ＝ 止める材料）
// ─────────────────────────────────────────────

/**
 * 非負整数の env を読む。未設定なら既定値。★数値として読めなければ null（既定へ黙って落とさない）。
 * @param {string|undefined} raw
 * @param {number} fallback
 * @returns {number|null}
 */
export function readLimit(raw, fallback) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

/** L1 キルスイッチ。'1' / 'true' / 'yes' / 'on' で止まる。 */
export function paidCallsDisabled(env = process.env) {
  return /^(1|true|yes|on)$/i.test(String(env.PAID_CALLS_DISABLED || '').trim());
}

// ─────────────────────────────────────────────
// カウンタ（Vercel KV / Upstash Redis の REST）
// ─────────────────────────────────────────────

/**
 * @typedef {{
 *   incrby(key:string, n:number): Promise<number>,
 *   decrby(key:string, n:number): Promise<number>,
 *   expire(key:string, sec:number): Promise<void>
 * }} CounterStore
 */

/**
 * env から Upstash REST のカウンタを作る。★無ければ null（＝POST は常に拒否）。
 *   Vercel の KV（Upstash 連携）は KV_REST_API_URL / KV_REST_API_TOKEN を入れる。
 *   Upstash を直接つないだ場合は UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN。
 * @returns {CounterStore|null}
 */
export function createUpstashStore(env = process.env, fetchImpl = globalThis.fetch) {
  const url = String(env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
  const token = String(env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token || typeof fetchImpl !== 'function') return null;
  async function cmd(args) {
    const r = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!r.ok) throw new Error(`counter ${r.status}`);
    const j = await r.json();
    if (j && j.error) throw new Error(`counter: ${j.error}`);
    return j?.result;
  }
  return {
    async incrby(key, n) { return Number(await cmd(['INCRBY', key, n])); },
    async decrby(key, n) { return Number(await cmd(['DECRBY', key, n])); },
    async expire(key, sec) { await cmd(['EXPIRE', key, sec]); }
  };
}

/**
 * プロセス内のカウンタ。★テストとローカル（scripts/serve-demo.mjs）専用。
 *   サーバーレスでは関数ごとに消えるので数えたことにならない。本番では使わない。
 * @returns {CounterStore & { peek(key:string):number }}
 */
export function createMemoryStore() {
  const m = new Map();
  return {
    async incrby(key, n) { const v = (m.get(key) || 0) + n; m.set(key, v); return v; },
    async decrby(key, n) { const v = (m.get(key) || 0) - n; m.set(key, v); return v; },
    async expire() {},
    peek(key) { return m.get(key) || 0; }
  };
}

// ─────────────────────────────────────────────
// 予約
// ─────────────────────────────────────────────

/** UTC の日付キー（YYYY-MM-DD）。 */
export function utcDateKey(at = new Date()) {
  return at.toISOString().slice(0, 10);
}

/**
 * 原子的に積んでから判定し、超えたら戻す（budget.ts の reserveMilli と同じ形）。
 * @returns {Promise<{ok:true, used:number, limit:number} | {ok:false, reason:'exhausted'|'unavailable', used?:number, limit?:number}>}
 */
async function reserveOn(store, key, cost, limit) {
  if (!store) return { ok: false, reason: 'unavailable' };
  if (limit === null || !Number.isFinite(limit)) return { ok: false, reason: 'unavailable' };
  if (!(cost > 0)) return { ok: false, reason: 'unavailable' };
  let after;
  try {
    after = Number(await store.incrby(key, cost));
    if (!Number.isFinite(after)) return { ok: false, reason: 'unavailable' };
    if (after === cost) await store.expire(key, COUNTER_TTL_SEC);
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (after > limit) {
    try { await store.decrby(key, cost); } catch { /* 戻せなくても止める（多く数える側） */ }
    return { ok: false, reason: 'exhausted', used: after - cost, limit };
  }
  return { ok: true, used: after, limit };
}

/** 予約を戻す（まだ呼んでいないときだけ使う）。 */
async function release(store, key, cost) {
  try { await store.decrby(key, cost); } catch { /* 多く数える側に倒す */ }
}

/** IP をそのままキーにしない（ログやダンプに生の IP を残さない）。 */
export async function hashIp(ip) {
  const data = new TextEncoder().encode(`characterlive-chat:${ip}`);
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 利用者に見せる文言（L6）。★正直に・短く。内部の事情（鍵・KV）は出さない。
 */
export const DENY_MESSAGES = Object.freeze({
  disabled: 'いまクラウドの会話は休止中です。',
  unavailable: 'クラウドの会話はまだ準備中です。',
  budget: '本日のクラウド会話枠は終了しました。明日またお試しください。',
  ip: 'この端末からの本日の会話回数が上限に達しました。明日またお試しください。'
});

/**
 * 呼ぶ前の守りを全部通す。通れば Fable を呼んでよい。
 * ★呼んだ後に失敗しても予約は戻さない（課金済みかもしれないので保守的に倒す）。
 *
 * @param {{ store: CounterStore|null, env?: Record<string,string|undefined>, ip: string,
 *           systemChars: number, userChars: number, at?: Date }} p
 * @returns {Promise<{ ok:true, costMilli:number } | { ok:false, status:number, code:string, reason:string }>}
 */
export async function reserveChatBudget(p) {
  const env = p.env || process.env;
  if (paidCallsDisabled(env)) {
    return { ok: false, status: 503, code: 'disabled', reason: DENY_MESSAGES.disabled };
  }
  const budgetLimit = readLimit(env.CHAT_DAILY_BUDGET_MILLI, DEFAULT_DAILY_BUDGET_MILLI);
  const ipLimit = readLimit(env.CHAT_IP_DAILY_CALLS, DEFAULT_IP_DAILY_CALLS);
  if (!p.store || budgetLimit === null || ipLimit === null) {
    return { ok: false, status: 503, code: 'unavailable', reason: DENY_MESSAGES.unavailable };
  }

  const day = utcDateKey(p.at);
  const cost = estimateCallMilli(p.systemChars, p.userChars);

  // L4 IP ごとの回数（先に見る：1人で全体の枠を使い切らせない）
  const ipKey = `chat:ip:${day}:${await hashIp(p.ip || 'unknown')}`;
  const ipRes = await reserveOn(p.store, ipKey, 1, ipLimit);
  if (!ipRes.ok) {
    return ipRes.reason === 'exhausted'
      ? { ok: false, status: 429, code: 'ip_limit', reason: DENY_MESSAGES.ip }
      : { ok: false, status: 503, code: 'unavailable', reason: DENY_MESSAGES.unavailable };
  }

  // L2 全体の日次予算
  const budgetKey = `chat:budget:anon:${day}`;
  const bRes = await reserveOn(p.store, budgetKey, cost, budgetLimit);
  if (!bRes.ok) {
    await release(p.store, ipKey, 1); // 呼んでいないので IP の1回は返す
    return bRes.reason === 'exhausted'
      ? { ok: false, status: 429, code: 'budget_exhausted', reason: DENY_MESSAGES.budget }
      : { ok: false, status: 503, code: 'unavailable', reason: DENY_MESSAGES.unavailable };
  }
  return { ok: true, costMilli: cost };
}

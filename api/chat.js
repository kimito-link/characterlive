/**
 * api/chat.js — クラウド頭脳（Claude Fable 5.1）の呼び出し口。
 *
 * ★なぜサーバ側か: API キーをブラウザに置けない（このリポは public）。
 *   キーは環境変数 ANTHROPIC_API_KEY でだけ受け取る。**ファイルに書かない。**
 *
 * ★同じ関数を2か所から使う:
 *   - Vercel の Serverless Function（/api/chat・自動検出）
 *   - ローカルの scripts/serve-demo.mjs（同じ URL を同じ handler に回す）
 *
 *   GET  /api/chat → { ok, ready, model, hasKey, hasCounter, disabled }  … 使えるかの点検（課金なし）
 *   POST /api/chat { charaId, mode?, user } → { ok, text, ms, servedBy } または { ok:false, code, reason }
 *
 * ★原価の守り（2026-10-19・COST_SAFETY_POLICY.md）:
 *   - system は**呼び出し側から受け取らない**。キャラ ID からサーバで組み立てる
 *     （受け取ると「誰でも使える汎用の Claude 代理」になる）。
 *   - user は USER_MAX_CHARS 字まで。
 *   - 同じオリジンの画面からだけ受ける（Origin 確認）。
 *   - 呼ぶ**前**に IP ごとの回数と日次予算を予約する（src/lib/chatCostGuard.js reserveChatBudget）。
 *     カウンタ（Vercel KV / Upstash）が無ければ POST は常に拒否（fail-closed）。
 *   - PAID_CALLS_DISABLED=1 で全部止まる（キルスイッチ）。
 */
import Anthropic from '@anthropic-ai/sdk';
import { buildCloudRequest, readCloudReply, CLOUD_MODEL, CLOUD_SYSTEM_EXTRA } from '../src/lib/charaCloudRequest.js';
import { buildSystemPrompt, PERSONAS, MODES, DEFAULT_MODE } from '../src/lib/charaPersona.v1.js';
import { roleRulesV2 } from '../src/lib/charaRules.v2.js';
import {
  reserveChatBudget, createUpstashStore, paidCallsDisabled, USER_MAX_CHARS
} from '../src/lib/chatCostGuard.js';

/** @type {Anthropic|null} */
let client = null;

export function hasKey(env = process.env) {
  return Boolean(env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) client = new Anthropic(); // ANTHROPIC_API_KEY を環境から読む
  return client;
}

/**
 * キャラの system をサーバで組み立てる（★charaBrain.js がクラウド頭脳に送っていたものと同じ形）。
 * @returns {string|null} 知らないキャラなら null
 */
export function serverSystemFor(charaId, mode) {
  if (!Object.prototype.hasOwnProperty.call(PERSONAS, charaId)) return null;
  const m = Object.prototype.hasOwnProperty.call(MODES, mode) ? mode : DEFAULT_MODE;
  return `${buildSystemPrompt(charaId, { mode: m })}\n${CLOUD_SYSTEM_EXTRA}\n${roleRulesV2(charaId)}`;
}

/**
 * Fable を1回呼ぶ（★守りは呼び出し元で済ませてから来る）。
 * @param {{ system:string, user:string }} input
 * @returns {Promise<{ ok:boolean, text?:string, servedBy?:string, reason?:string }>}
 */
async function callFable(input) {
  try {
    const response = await getClient().beta.messages.create(buildCloudRequest(input));
    return readCloudReply(response);
  } catch (e) {
    return { ok: false, reason: describeError(e) };
  }
}

/** SDK の例外を、画面に出せる短い日本語にする。 */
function describeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'API キーが無効です';
  if (e instanceof Anthropic.RateLimitError) return '呼びすぎです。少し待ってください';
  if (e instanceof Anthropic.BadRequestError) return `依頼が不正です: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `API エラー ${e.status}: ${e.message}`;
  return String(e?.message || e);
}

/** 本文を JSON として読む（Vercel は req.body を用意する。素の Node では自分で読む）。 */
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new Error('too large'); // 本文の上限より十分大きい。巨大な本文を読み切らない
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function header(req, name) {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : (v || '');
}

/**
 * 利用者の IP。★Vercel は x-vercel-forwarded-for / x-real-ip を自分で付け直す（利用者は偽れない）。
 *   x-forwarded-for の先頭は最後の手段。
 */
export function clientIp(req) {
  return String(
    header(req, 'x-vercel-forwarded-for') || header(req, 'x-real-ip') ||
    header(req, 'x-forwarded-for').split(',')[0] || req.socket?.remoteAddress || 'unknown'
  ).trim();
}

/**
 * 同じオリジンの画面から来たか。★ブラウザは POST の fetch に必ず Origin を付ける。
 *   Origin が無い・ホストが違う → 断る。CHAT_ALLOWED_ORIGINS（カンマ区切り）で追加できる。
 *   ★これは「よそのサイトに埋め込まれて使われる」を防ぐ層で、スクリプト直叩きは IP 上限と予算で止める。
 */
export function originAllowed(req, env = process.env) {
  const origin = header(req, 'origin');
  if (!origin) return false;
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  if (host && host === header(req, 'host')) return true;
  const extra = String(env.CHAT_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return extra.includes(origin);
}

/**
 * HTTP の入口を作る（★テストではカウンタ・env・Fable を差し替える）。
 * @param {{ store?: any, env?: Record<string,string|undefined>, callModel?: (i:{system:string,user:string})=>Promise<any> }} [deps]
 */
export function createHandler(deps = {}) {
  const env = deps.env || process.env;
  const callModel = deps.callModel || callFable;
  const storeOf = () => (deps.store !== undefined ? deps.store : createUpstashStore(env));

  /**
   * @param {import('node:http').IncomingMessage & { body?: any }} req
   * @param {import('node:http').ServerResponse} res
   */
  return async function handler(req, res) {
    if (req.method === 'GET') {
      const key = hasKey(env);
      const counter = Boolean(storeOf());
      const disabled = paidCallsDisabled(env);
      const ready = key && counter && !disabled;
      sendJson(res, 200, { ok: ready, ready, model: CLOUD_MODEL, hasKey: key, hasCounter: counter, disabled });
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, code: 'method', reason: 'POST か GET だけ' });
      return;
    }
    if (!originAllowed(req, env)) {
      sendJson(res, 403, { ok: false, code: 'origin', reason: 'この画面からは使えません' });
      return;
    }
    let body;
    try {
      body = await readJson(req);
    } catch {
      sendJson(res, 400, { ok: false, code: 'bad_json', reason: 'JSON が読めません' });
      return;
    }
    // ★system は受け取らない（送られてきても読まない）
    const system = serverSystemFor(String(body?.charaId || ''), String(body?.mode || ''));
    if (!system) {
      sendJson(res, 400, { ok: false, code: 'bad_chara', reason: '知らないキャラです' });
      return;
    }
    const user = typeof body?.user === 'string' ? body.user.trim() : '';
    if (!user) {
      sendJson(res, 400, { ok: false, code: 'empty', reason: '本文が空です' });
      return;
    }
    if (user.length > USER_MAX_CHARS) {
      sendJson(res, 413, { ok: false, code: 'too_long', reason: `本文は ${USER_MAX_CHARS} 字までです` });
      return;
    }
    if (!hasKey(env)) {
      sendJson(res, 503, { ok: false, code: 'no_key', reason: 'ANTHROPIC_API_KEY が設定されていません' });
      return;
    }

    // ★呼ぶ前に予約する（通らなければ呼ばない）
    const gate = await reserveChatBudget({
      store: storeOf(), env, ip: clientIp(req), systemChars: system.length, userChars: user.length
    });
    if (!gate.ok) {
      sendJson(res, gate.status, { ok: false, code: gate.code, reason: gate.reason });
      return;
    }

    const t0 = Date.now();
    const r = await callModel({ system, user });
    sendJson(res, r.ok ? 200 : 502, { ...r, ms: Date.now() - t0 });
  };
}

export default createHandler();

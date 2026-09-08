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
 *   GET  /api/chat → { ok, model, hasKey }  … 使えるかの点検（鍵の有無だけ・課金なし）
 *   POST /api/chat { system, user } → { ok, text, ms, servedBy } または { ok:false, reason }
 */
import Anthropic from '@anthropic-ai/sdk';
import { buildCloudRequest, readCloudReply, CLOUD_MODEL } from '../src/lib/charaCloudRequest.js';

/** @type {Anthropic|null} */
let client = null;

export function hasKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) client = new Anthropic(); // ANTHROPIC_API_KEY を環境から読む
  return client;
}

/**
 * 1回の返事を作る。
 * @param {{ system:string, user:string }} input
 * @returns {Promise<{ ok:boolean, text?:string, ms:number, servedBy?:string, reason?:string }>}
 */
export async function chat(input) {
  const t0 = Date.now();
  if (!hasKey()) {
    return { ok: false, ms: 0, reason: 'ANTHROPIC_API_KEY が設定されていません' };
  }
  let req;
  try {
    req = buildCloudRequest(input);
  } catch (e) {
    return { ok: false, ms: 0, reason: String(e?.message || e) };
  }
  try {
    const response = await getClient().beta.messages.create(req);
    const r = readCloudReply(response);
    return { ...r, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, reason: describeError(e) };
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
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * HTTP の入口（Vercel Node Function の形）。
 * @param {import('node:http').IncomingMessage & { body?: any }} req
 * @param {import('node:http').ServerResponse} res
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    sendJson(res, 200, { ok: hasKey(), model: CLOUD_MODEL, hasKey: hasKey() });
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, reason: 'POST か GET だけ' });
    return;
  }
  let body;
  try {
    body = await readJson(req);
  } catch {
    sendJson(res, 400, { ok: false, reason: 'JSON が読めません' });
    return;
  }
  const r = await chat({ system: body?.system, user: body?.user });
  sendJson(res, r.ok ? 200 : 502, r);
}

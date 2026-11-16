/**
 * Cloudflare Pages Function: /api/chat
 *
 * 役割: Vercel の api/chat.js（正本）を、そのまま Pages で動かす薄い差し込み口。
 * 判定（呼び出し元の確認・キャラ検証・文字数上限・1日の予算と IP ごとの回数の予約）は
 * すべて api/chat.js の createHandler に任せ、ここでは Request/Response を
 * Node 風の req/res に詰め替えるだけ。ここに判定を書き足さない（二重管理になる）。
 *
 * 必要な secret: ANTHROPIC_API_KEY と、予算カウンタ用の
 * KV_REST_API_URL / KV_REST_API_TOKEN（または UPSTASH_REDIS_REST_URL / _TOKEN）。
 * カウンタが無いと api/chat.js は呼ばずに断る（fail-closed）。
 */
import Anthropic from '@anthropic-ai/sdk';
import { createHandler } from '../../api/chat.js';
import { buildCloudRequest, readCloudReply } from '../../src/lib/charaCloudRequest.js';

/** SDK の例外を、画面に出せる短い日本語にする（api/chat.js の describeError と同じ文言）。 */
function describeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'API キーが無効です';
  if (e instanceof Anthropic.RateLimitError) return '呼びすぎです。少し待ってください';
  if (e instanceof Anthropic.BadRequestError) return `依頼が不正です: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `API エラー ${e.status}: ${e.message}`;
  return String(e?.message || e);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const headers = {};
  for (const [k, v] of request.headers) headers[k.toLowerCase()] = v;
  headers.host = url.host;
  // api/chat.js の clientIp は x-real-ip を見る。Cloudflare の接続元 IP を渡す。
  if (headers['cf-connecting-ip']) headers['x-real-ip'] = headers['cf-connecting-ip'];

  let body;
  if (request.method === 'POST') {
    const raw = await request.text();
    if (raw.length > 64 * 1024) {
      return new Response(JSON.stringify({ ok: false, code: 'bad_json', reason: 'JSON が読めません' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }
    body = raw;
  }
  const req = { method: request.method, headers, body, socket: {} };

  let status = 200;
  const resHeaders = new Headers();
  let out = '';
  const res = {
    set statusCode(v) { status = v; },
    get statusCode() { return status; },
    setHeader(k, v) { resHeaders.set(k, String(v)); },
    end(s) { out = s ?? ''; },
  };

  const handler = createHandler({
    env,
    callModel: async (input) => {
      try {
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
        return readCloudReply(await client.beta.messages.create(buildCloudRequest(input)));
      } catch (e) {
        return { ok: false, reason: describeError(e) };
      }
    },
  });
  await handler(req, res);
  return new Response(out, { status, headers: resHeaders });
}

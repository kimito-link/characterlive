import Anthropic from '@anthropic-ai/sdk';
import { buildCloudRequest, readCloudReply, CLOUD_MODEL } from '../../src/lib/charaCloudRequest.js';

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function describeError(e) {
  if (e instanceof Anthropic.AuthenticationError) return 'API キーが無効です';
  if (e instanceof Anthropic.RateLimitError) return '呼びすぎです。少し待ってください';
  if (e instanceof Anthropic.BadRequestError) return `依頼が不正です: ${e.message}`;
  if (e instanceof Anthropic.APIError) return `API エラー ${e.status}: ${e.message}`;
  return String(e?.message || e);
}

export async function onRequest({ request, env }) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (request.method === 'GET') {
    return jsonResponse(200, { ok: Boolean(apiKey), model: CLOUD_MODEL, hasKey: Boolean(apiKey) });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, reason: 'POST か GET だけ' });
  }
  if (!apiKey) {
    return jsonResponse(200, { ok: false, ms: 0, reason: 'ANTHROPIC_API_KEY が設定されていません' });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, reason: 'JSON が読めません' });
  }

  const t0 = Date.now();
  let reqPayload;
  try {
    reqPayload = buildCloudRequest(input);
  } catch (e) {
    return jsonResponse(200, { ok: false, ms: 0, reason: String(e?.message || e) });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.beta.messages.create(reqPayload);
    const reply = readCloudReply(response);
    return jsonResponse(200, { ...reply, ms: Date.now() - t0 });
  } catch (e) {
    return jsonResponse(200, { ok: false, ms: Date.now() - t0, reason: describeError(e) });
  }
}

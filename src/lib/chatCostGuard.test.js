import { describe, it, expect } from 'vitest';
import {
  reserveChatBudget, createMemoryStore, createUpstashStore, estimateCallMilli, readLimit,
  paidCallsDisabled, MAX_CALL_MILLI, DEFAULT_DAILY_BUDGET_MILLI, USER_MAX_CHARS, DENY_MESSAGES
} from './chatCostGuard.js';

const base = { ip: '203.0.113.7', systemChars: 800, userChars: 1000 };

describe('見積り（見積りと上限は同じ定数から導く）', () => {
  it('既定の日次予算は1回の最大見積りより大きい（「必ず拒否」にならない）', () => {
    expect(DEFAULT_DAILY_BUDGET_MILLI).toBe(500); // 2026-10-20 の裁定（約75円/日）
    expect(DEFAULT_DAILY_BUDGET_MILLI).toBeGreaterThan(MAX_CALL_MILLI);
    expect(MAX_CALL_MILLI).toBe(estimateCallMilli(1500, USER_MAX_CHARS));
  });

  it('本文が長いほど見積りが大きい（切り上げで0にならない）', () => {
    expect(estimateCallMilli(0, 1)).toBeGreaterThan(0);
    expect(estimateCallMilli(800, 4000)).toBeGreaterThan(estimateCallMilli(800, 100));
  });
});

describe('readLimit（読めない上限は null ＝ 止める）', () => {
  it('未設定は既定値・数値は採用・壊れた値は null', () => {
    expect(readLimit(undefined, 5)).toBe(5);
    expect(readLimit('', 5)).toBe(5);
    expect(readLimit('0', 5)).toBe(0);
    expect(readLimit('12', 5)).toBe(12);
    expect(readLimit('abc', 5)).toBeNull();
    expect(readLimit('-1', 5)).toBeNull();
    expect(readLimit('1.5', 5)).toBeNull();
  });
});

describe('reserveChatBudget（fail-closed の実証）', () => {
  it('カウンタが無ければ呼ばない', async () => {
    const r = await reserveChatBudget({ ...base, store: null, env: {} });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('unavailable');
    expect(r.status).toBe(503);
  });

  it('カウンタが例外を投げたら呼ばない', async () => {
    const broken = {
      incrby: async () => { throw new Error('down'); },
      decrby: async () => 0,
      expire: async () => {}
    };
    const r = await reserveChatBudget({ ...base, store: broken, env: {} });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('unavailable');
  });

  it('上限の env が数値として読めなければ呼ばない', async () => {
    const r1 = await reserveChatBudget({ ...base, store: createMemoryStore(), env: { CHAT_DAILY_BUDGET_MILLI: 'lots' } });
    const r2 = await reserveChatBudget({ ...base, store: createMemoryStore(), env: { CHAT_IP_DAILY_CALLS: '-3' } });
    expect(r1.code).toBe('unavailable');
    expect(r2.code).toBe('unavailable');
  });

  it('キルスイッチ PAID_CALLS_DISABLED=1 で止まる（カウンタがあっても）', async () => {
    const store = createMemoryStore();
    const r = await reserveChatBudget({ ...base, store, env: { PAID_CALLS_DISABLED: '1' } });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('disabled');
    expect(paidCallsDisabled({ PAID_CALLS_DISABLED: 'true' })).toBe(true);
    expect(paidCallsDisabled({})).toBe(false);
  });

  it('日次予算を小さくすると、超えた分が拒否される（予約は呼ぶ前）', async () => {
    const store = createMemoryStore();
    const one = estimateCallMilli(base.systemChars, base.userChars);
    const env = { CHAT_DAILY_BUDGET_MILLI: String(one * 2), CHAT_IP_DAILY_CALLS: '100' };
    const at = new Date('2026-10-19T03:00:00Z');
    const ips = ['198.51.100.1', '198.51.100.2', '198.51.100.3'];
    const rs = [];
    for (const ip of ips) rs.push(await reserveChatBudget({ ...base, ip, store, env, at }));
    expect(rs.map((r) => r.ok)).toEqual([true, true, false]);
    expect(rs[2].code).toBe('budget_exhausted');
    expect(rs[2].status).toBe(429);
    expect(rs[2].reason).toBe(DENY_MESSAGES.budget);
    // ★拒否した分は戻している（使用量は2回分のまま）
    expect(store.peek('chat:budget:anon:2026-10-19')).toBe(one * 2);
  });

  it('予算 0 なら1回目から拒否', async () => {
    const r = await reserveChatBudget({ ...base, store: createMemoryStore(), env: { CHAT_DAILY_BUDGET_MILLI: '0' } });
    expect(r.code).toBe('budget_exhausted');
  });

  it('IP ごとの上限を小さくすると、同じ IP の超過分が拒否される（別の IP は通る）', async () => {
    const store = createMemoryStore();
    const env = { CHAT_IP_DAILY_CALLS: '2' };
    const a1 = await reserveChatBudget({ ...base, store, env });
    const a2 = await reserveChatBudget({ ...base, store, env });
    const a3 = await reserveChatBudget({ ...base, store, env });
    const b1 = await reserveChatBudget({ ...base, ip: '203.0.113.99', store, env });
    expect([a1.ok, a2.ok, a3.ok, b1.ok]).toEqual([true, true, false, true]);
    expect(a3.code).toBe('ip_limit');
    expect(a3.reason).toBe(DENY_MESSAGES.ip);
  });

  it('日付が変われば枠は戻る（キーが日ごと）', async () => {
    const store = createMemoryStore();
    const env = { CHAT_IP_DAILY_CALLS: '1' };
    const d1 = await reserveChatBudget({ ...base, store, env, at: new Date('2026-10-19T10:00:00Z') });
    const d1b = await reserveChatBudget({ ...base, store, env, at: new Date('2026-10-19T11:00:00Z') });
    const d2 = await reserveChatBudget({ ...base, store, env, at: new Date('2026-10-20T00:10:00Z') });
    expect([d1.ok, d1b.ok, d2.ok]).toEqual([true, false, true]);
  });
});

describe('createUpstashStore', () => {
  it('URL かトークンが無ければ null（＝POST は拒否）', () => {
    expect(createUpstashStore({}, async () => ({}))).toBeNull();
    expect(createUpstashStore({ KV_REST_API_URL: 'https://x' }, async () => ({}))).toBeNull();
  });

  it('INCRBY を REST で送り、結果を数値で返す', async () => {
    const calls = [];
    const fakeFetch = async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ result: 42 }) };
    };
    const s = createUpstashStore({ KV_REST_API_URL: 'https://kv.example/', KV_REST_API_TOKEN: 't' }, fakeFetch);
    expect(await s.incrby('k', 5)).toBe(42);
    expect(calls[0].url).toBe('https://kv.example');
    expect(JSON.parse(calls[0].init.body)).toEqual(['INCRBY', 'k', 5]);
    expect(calls[0].init.headers.authorization).toBe('Bearer t');
  });

  it('REST がエラーを返したら例外（→ 予約側で fail-closed）', async () => {
    const s = createUpstashStore({ UPSTASH_REDIS_REST_URL: 'https://kv', UPSTASH_REDIS_REST_TOKEN: 't' },
      async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const r = await reserveChatBudget({ ...base, store: s, env: {} });
    expect(r.code).toBe('unavailable');
  });
});

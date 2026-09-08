import { describe, it, expect } from 'vitest';
import {
  buildCloudRequest, readCloudReply,
  CLOUD_MODEL, FALLBACK_BETA, CLOUD_SYSTEM_EXTRA
} from './charaCloudRequest.js';

describe('buildCloudRequest', () => {
  it('Fable 5.1 を名指しし、thinking は送らない（常時オンのため 400 になる）', () => {
    const r = buildCloudRequest({ system: '人格', user: '相手:「こんにちは」' });
    expect(r.model).toBe('claude-fable-5-1');
    expect(r.model).toBe(CLOUD_MODEL);
    expect(r).not.toHaveProperty('thinking');
    expect(r).not.toHaveProperty('temperature');
    expect(r).not.toHaveProperty('tool_choice');
  });

  it('断られたときの逃げ道（fallbacks）を既定で付ける', () => {
    const r = buildCloudRequest({ system: '人格', user: 'x' });
    expect(r.fallbacks).toBe('default');
    expect(r.betas).toContain(FALLBACK_BETA);
  });

  it('会話向けに effort は low', () => {
    const r = buildCloudRequest({ system: '人格', user: 'x' });
    expect(r.output_config.effort).toBe('low');
  });

  it('user は1ターンだけ（履歴は本文に畳んで渡す）', () => {
    const r = buildCloudRequest({ system: '人格', user: '本文' });
    expect(r.messages).toEqual([{ role: 'user', content: '本文' }]);
  });

  it('空の system / user は例外', () => {
    expect(() => buildCloudRequest({ system: '', user: 'x' })).toThrow();
    expect(() => buildCloudRequest({ system: 'x', user: '  ' })).toThrow();
  });
});

describe('readCloudReply', () => {
  it('text ブロックだけを繋いで返す', () => {
    const r = readCloudReply({
      model: 'claude-fable-5-1',
      stop_reason: 'end_turn',
      content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'いいのだ！' }]
    });
    expect(r).toEqual({ ok: true, text: 'いいのだ！', servedBy: 'claude-fable-5-1' });
  });

  it('refusal のときは content を読まず、分類を理由に出す', () => {
    const r = readCloudReply({
      model: 'claude-fable-5-1',
      stop_reason: 'refusal',
      stop_details: { type: 'refusal', category: 'cyber' },
      content: [{ type: 'text', text: '読んではいけない' }]
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('cyber');
    expect(r).not.toHaveProperty('text');
  });

  it('本文が無ければ ok:false', () => {
    expect(readCloudReply({ stop_reason: 'end_turn', content: [] }).ok).toBe(false);
    expect(readCloudReply(null).ok).toBe(false);
  });
});

describe('CLOUD_SYSTEM_EXTRA', () => {
  it('音声認識の崩れを前後から補う指示が入っている（真因への対策）', () => {
    expect(CLOUD_SYSTEM_EXTRA).toContain('音声認識');
    expect(CLOUD_SYSTEM_EXTRA).toContain('前後');
    expect(CLOUD_SYSTEM_EXTRA).toContain('繰り返さない');
  });
});

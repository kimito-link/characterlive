/**
 * charaBackchannel.test.js — 相槌の出し方を固定する。
 *
 * ★背景（2026-09-06・実測）
 *   返事を作っている1.9秒（推論1300 + 合成600）が無音になり、
 *   そこで「会話が止まった」と感じていた。
 *   ★人間も同じ問題を相槌で埋めている（Levinson: 隙間200ms vs 計画600ms）。
 */
import { describe, it, expect } from 'vitest';
import { BACKCHANNELS, shouldBackchannel } from './charaBackchannel.js';
import { PERSONA_IDS } from './charaPersona.v1.js';

describe('相槌は3人ぶん用意する', () => {
  it('全員に相槌がある', () => {
    for (const id of PERSONA_IDS) {
      expect(BACKCHANNELS[id]?.length).toBeGreaterThan(0);
    }
  });

  it('★短いこと（長いと本命に食い込む）', () => {
    for (const id of PERSONA_IDS) {
      for (const line of BACKCHANNELS[id]) {
        expect(line.length).toBeLessThanOrEqual(6);
      }
    }
  });

  it('★キャラごとに違う（3人が同じ相槌だと個性が消える）', () => {
    const all = PERSONA_IDS.flatMap((id) => BACKCHANNELS[id]);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('★毎回は鳴らさない（相槌が毎ターン入るとうるさい）', () => {
  it('リレー中は出さない（3人が順に喋るので渋滞する）', () => {
    expect(shouldBackchannel({ isRelay: true })).toBe(false);
  });

  it('★前回が速かったなら出さない（挟むとかえって遅くなる）', () => {
    expect(shouldBackchannel({ lastThinkMs: 500 })).toBe(false);
  });

  it('遅くなりそうなときは出す', () => {
    expect(shouldBackchannel({ lastThinkMs: 1300 })).toBe(true);
  });
});

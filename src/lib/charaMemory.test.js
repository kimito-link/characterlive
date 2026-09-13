import { describe, it, expect } from 'vitest';
import {
  remember, pickup, memoryDirective, parseMemory, serializeMemory,
  MEMORY_MAX, MEMORY_MIN_AGE_MS, MEMORY_TTL_MS
} from './charaMemory.js';

const MIN = 60_000;

describe('remember — 配信者の発話を覚える', () => {
  it('短い相槌は覚えない。同じ文は二重に持たない。上限で古い方から落ちる', () => {
    let m = remember([], { text: 'うん', tMs: 1 });
    expect(m).toEqual([]);
    m = remember(m, { text: '今日コメント0だった', tMs: 1 });
    m = remember(m, { text: '今日コメント0だった', tMs: 2 });
    expect(m).toHaveLength(1);
    for (let i = 0; i < MEMORY_MAX + 5; i += 1) m = remember(m, { text: `話題その${i}についての話`, tMs: 10 + i });
    expect(m).toHaveLength(MEMORY_MAX);
    expect(m[0].text).not.toBe('今日コメント0だった');
  });

  it('元の配列を変えない（純関数）', () => {
    const a = [];
    const b = remember(a, { text: '先週フォロワー3人減った', tMs: 1 });
    expect(a).toEqual([]);
    expect(b).toHaveLength(1);
  });
});

describe('pickup — 「前回」の話を1つだけ', () => {
  const t0 = 1_000_000_000_000;
  const items = [
    { text: '先週フォロワー3人減った', tMs: t0 - 2 * 24 * 60 * MIN },   // 2日前
    { text: 'ちょっとコンビニ寄る', tMs: t0 - 30 * MIN },                // 30分前
    { text: 'いま配信始めた', tMs: t0 - 2 * MIN }                        // 2分前（今回）
  ];
  it('10分より前で、いちばん新しいものを返す（今回の発話は返さない）', () => {
    expect(pickup(items, t0)).toBe('ちょっとコンビニ寄る');
  });
  it('7日より古いものは返さない', () => {
    const old = [{ text: '大昔の話', tMs: t0 - MEMORY_TTL_MS - MIN }];
    expect(pickup(old, t0)).toBe('');
  });
  it('境界: ちょうど10分前は返す', () => {
    expect(pickup([{ text: '十分前の話だよ', tMs: t0 - MEMORY_MIN_AGE_MS }], t0)).toBe('十分前の話だよ');
  });
  it('無ければ空', () => {
    expect(pickup([], t0)).toBe('');
    expect(pickup(undefined, t0)).toBe('');
  });
});

describe('memoryDirective — 指示は「1つだけ・自然に・毎回ではない」', () => {
  it('行があれば指示、無ければ空', () => {
    expect(memoryDirective('コンビニ寄る')).toContain('「コンビニ寄る」');
    expect(memoryDirective('コンビニ寄る')).toContain('1つだけ');
    expect(memoryDirective('')).toBe('');
  });
});

describe('parse / serialize — 壊れた保存を握りつぶす', () => {
  it('壊れた JSON や型違いは空になる', () => {
    expect(parseMemory('{not json')).toEqual([]);
    expect(parseMemory('[{"text":1},{"text":"ok","tMs":"x"},{"text":"ok","tMs":5}]')).toEqual([{ text: 'ok', tMs: 5 }]);
  });
  it('往復できる', () => {
    const m = remember([], { text: '今日はうまくいかなかった', tMs: 7 });
    expect(parseMemory(serializeMemory(m))).toEqual(m);
  });
});

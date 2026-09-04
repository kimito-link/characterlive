/**
 * charaMotion.test.js — 状態別の動きを固定する。
 *
 * ★ユーザー指示(2026-09-04):
 *   「常時回転や常時跳ねるは禁止。目障りになる」
 *   「3キャラが同時に派手に動くのは禁止。喋ってる1人だけ」
 *   → ★動きを足す"改善"は、この製品では画面をうるさくする劣化になりうる。テストで止める。
 */
import { describe, it, expect } from 'vitest';
import {
  resolveStateMotion, shouldSpinThisTurn, spinAngleDeg,
  BOUNCE_MAX_PX, BREATH_AMOUNT
} from './charaMotion.js';

const at = (t, state) => resolveStateMotion({ timeMs: t, state, charaId: 'rinku' });

describe('★喋っていない子には何も足さない（控えめの一番確実な実装）', () => {
  for (const state of ['idle', 'listening']) {
    it(`${state} は浮遊だけ`, () => {
      for (const t of [0, 300, 700, 1500]) {
        const m = at(t, state);
        expect(m.dy).toBe(0);
        expect(m.dTiltDeg).toBe(0);
        expect(m.scaleMul).toBe(1);
      }
    });
  }
});

describe('考えてる = 呼吸（跳ねない・回らない）', () => {
  it('拡大縮小する', () => {
    const vals = [0, 375, 750, 1125].map((t) => at(t, 'thinking').scaleMul);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.02);
  });

  it('★回らない（考えているときに回ると落ち着かない）', () => {
    for (const t of [0, 375, 750]) expect(at(t, 'thinking').dTiltDeg).toBe(0);
  });

  it('★膨らみすぎない（±3%まで）', () => {
    for (const t of [0, 200, 375, 600, 900, 1200]) {
      expect(Math.abs(at(t, 'thinking').scaleMul - 1)).toBeLessThanOrEqual(BREATH_AMOUNT + 0.001);
    }
  });
});

describe('喋ってる = 跳ねる + 左右の揺れ', () => {
  it('上に跳ねる（下に沈まない）', () => {
    for (const t of [0, 100, 155, 300, 465, 620]) {
      expect(at(t, 'speaking').dy).toBeLessThanOrEqual(0);
    }
  });

  it('★跳ねすぎない（7pxまで）', () => {
    for (let t = 0; t <= 1240; t += 20) {
      expect(Math.abs(at(t, 'speaking').dy)).toBeLessThanOrEqual(BOUNCE_MAX_PX + 0.001);
    }
  });

  it('左右に揺れる', () => {
    const vals = [0, 275, 550, 825].map((t) => at(t, 'speaking').dTiltDeg);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(2);
  });

  it('★跳ねと揺れの周期をそろえない（同期すると機械的に見える）', () => {
    // 跳ねが頂点(155ms)のとき、揺れは頂点になっていない
    const m = at(155, 'speaking');
    expect(Math.abs(m.dTiltDeg)).toBeLessThan(2.4);
  });
});

describe('★回転は「たまに」（常時回転は禁止）', () => {
  it('ほとんどの発話では回らない', () => {
    let hit = 0;
    for (let i = 0; i < 100; i += 1) {
      if (shouldSpinThisTurn({ charaId: 'rinku', modeStartedAtMs: i * 5000 })) hit += 1;
    }
    // 1回の会話で1〜2回 = 2割以下
    expect(hit).toBeGreaterThan(3);
    expect(hit).toBeLessThan(30);
  });

  it('★同じ発話中は判定が変わらない（回ったり戻ったりしない）', () => {
    const a = shouldSpinThisTurn({ charaId: 'konta', modeStartedAtMs: 12345 });
    for (let i = 0; i < 20; i += 1) {
      expect(shouldSpinThisTurn({ charaId: 'konta', modeStartedAtMs: 12345 })).toBe(a);
    }
  });

  it('★半回転して戻る（回りっぱなしにしない）', () => {
    expect(spinAngleDeg(0)).toBe(0);
    expect(spinAngleDeg(450)).toBeCloseTo(180, 0);
    expect(spinAngleDeg(900)).toBeCloseTo(0, 0);
    expect(spinAngleDeg(2000)).toBe(0); // 終わったら戻る
  });
});

describe('動きを止められる（prefers-reduced-motion）', () => {
  it('reducedMotion なら何も動かない', () => {
    for (const state of ['idle', 'listening', 'thinking', 'speaking']) {
      const m = resolveStateMotion({ timeMs: 500, state, charaId: 'rinku', reducedMotion: true });
      expect(m.dy).toBe(0);
      expect(m.dTiltDeg).toBe(0);
      expect(m.scaleMul).toBe(1);
    }
  });
});

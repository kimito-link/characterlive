/**
 * charaTurnEnd.test.js — 「話し終わったか」の判定を固定する。
 *
 * ★背景（2026-09-06・実測）
 *   1往復に5.4秒かかっていた（話し終わり待ち3500 + 返事開始2000 + 推論1300 + 合成600）。
 *   人間同士の会話は平均208ms・最頻値0ms（Stivers 2009, PNAS）。★桁が2つ違う。
 *   ★そのうち3500msは「無音を数えていただけ」。ここを文の完結度で置き換えた。
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTurnEnd, canStartThinking, END_FAST_MS, END_SLOW_MS
} from './charaTurnEnd.js';

describe('★言い切っていれば、すぐ返す', () => {
  it('句点で終われば最速', () => {
    expect(resolveTurnEnd('今日は疲れた。').waitMs).toBe(END_FAST_MS);
    expect(resolveTurnEnd('これどう思う？').waitMs).toBe(END_FAST_MS);
  });

  it('言い切りの語尾なら最速', () => {
    expect(resolveTurnEnd('今日は配信で失敗した').waitMs).toBe(END_FAST_MS);
    expect(resolveTurnEnd('たぶん大丈夫だよね').waitMs).toBe(END_FAST_MS);
  });

  // ★短い文は語尾が言い切りでも待つ（「大丈夫だよね」は6字なのでこちら）
  it('★短い言い切りは待つ側に倒す（言葉を奪わないため）', () => {
    expect(resolveTurnEnd('大丈夫だよね').waitMs).toBe(END_SLOW_MS);
  });

  it('★最速でも250ms前後（人間の会話は平均208ms）', () => {
    expect(END_FAST_MS).toBeLessThanOrEqual(400);
  });
});

describe('★続きそうなら待つ（言葉を奪わない）', () => {
  it('接続助詞で終わったら待つ', () => {
    expect(resolveTurnEnd('フォロワー増えないんだけど').waitMs).toBe(END_SLOW_MS);
    expect(resolveTurnEnd('やってみたけど').waitMs).toBe(END_SLOW_MS);
  });

  it('言いよどみで終わったら待つ', () => {
    expect(resolveTurnEnd('えっと').waitMs).toBe(END_SLOW_MS);
    expect(resolveTurnEnd('なんか').waitMs).toBe(END_SLOW_MS);
  });

  it('★実害を出した文は必ず待つ（「しゃべれる」「のに」）', () => {
    // 語尾が「る」なので言い切りに見えるが、実際は途中だった
    expect(resolveTurnEnd('しゃべれる').complete).toBe(false);
    expect(resolveTurnEnd('のに').complete).toBe(false);
  });

  it('★短い文では語尾の判定を信用しない（6字以下は待つ）', () => {
    expect(resolveTurnEnd('つかれた').complete).toBe(false);
    expect(resolveTurnEnd('そうだね').complete).toBe(false);
  });
});

describe('★先に考え始めてよいか（聞きながら準備する）', () => {
  it('言い切っていて、十分な長さがあれば始める', () => {
    expect(canStartThinking('今日は配信で失敗した')).toBe(true);
  });

  it('断片では始めない（無駄打ちを避ける）', () => {
    expect(canStartThinking('うん')).toBe(false);
    expect(canStartThinking('つかれた')).toBe(false);
  });

  it('続きそうなら始めない', () => {
    expect(canStartThinking('フォロワー増えないんだけど')).toBe(false);
  });
});

describe('★待ち時間の幅（急かさず、遅すぎない）', () => {
  it('最長でも2.5秒（以前は一律3.5秒だった）', () => {
    expect(END_SLOW_MS).toBeLessThanOrEqual(2500);
  });
  it('言い切りと続きそうで10倍近い差がある（判定が意味を持つ）', () => {
    expect(END_SLOW_MS / END_FAST_MS).toBeGreaterThan(5);
  });
});

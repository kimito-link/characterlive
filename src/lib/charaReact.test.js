/**
 * charaReact.test.js — 「反応したくなる返答」の骨格を固定する。
 *
 * ★背景（2026-09-06・Grokに相談して判明した最大の設計ミス）
 *   Grok:「速さの問題じゃない。1往復が1秒になっても、いまの設計のままなら
 *          "会話してる感じ"は出ない。欠けてるのはレイテンシじゃなく、
 *          相手の予想を壊す力と、人間が反応せざるを得ない圧力」
 *   Grok:「いまのシステムは良い司会者。必要なのは良い相手役。
 *          司会は安全、相手役は危険。配信が盛り上がるのは後者」
 */
import { describe, it, expect } from 'vitest';
import { findSorePoint, reactDirective, checkNotTooHarsh } from './charaReact.js';

describe('★急所を拾う（要約ではなく、痛いところ）', () => {
  it('数字が伸びない話を拾う（配信者に最も重い）', () => {
    expect(findSorePoint('フォロワー増えない').point).toBe('増えない');
    expect(findSorePoint('今日は0人だった').point).toBe('0人');
  });

  it('自己否定を拾う（ここを外すと「わかってくれない」になる）', () => {
    expect(findSorePoint('自分には向いてないのかも').point).toBe('向いてない');
  });

  it('続けるかどうかの迷いを拾う（最も反応が大きい）', () => {
    expect(findSorePoint('もうやめたい').kind).toBe('quitting');
  });

  it('他人との比較を拾う', () => {
    expect(findSorePoint('みんなすごいのに').kind).toBe('comparison');
  });

  it('急所が無ければ何も返さない（無理に探さない）', () => {
    expect(findSorePoint('今日はいい天気').point).toBe(null);
  });
});

describe('★同じ急所でも、キャラで答えの方向が変わる', () => {
  const sore = findSorePoint('フォロワー増えない');

  it('りんくは気持ちを言葉にする（解決しようとしない）', () => {
    const d = reactDirective({ charaId: 'rinku', ...sore });
    expect(d).toMatch(/気持ちを言葉にする/);
    expect(d).toMatch(/解決しようとしない/);
  });

  it('こん太は見落としを指す', () => {
    expect(reactDirective({ charaId: 'konta', ...sore })).toMatch(/見ていない面/);
  });

  it('★たぬ姉は問いを返す（次の一手を相手に渡す）', () => {
    const d = reactDirective({ charaId: 'tanunee', ...sore });
    expect(d).toMatch(/言いにくいこと/);
    expect(d).toMatch(/問いを返す/);
  });

  it('★全員が急所に触れる（触れないと当たり障りのない返事になる）', () => {
    for (const id of ['rinku', 'konta', 'tanunee']) {
      expect(reactDirective({ charaId: id, ...sore })).toContain('増えない');
    }
  });

  it('★問いを返すのはたぬ姉だけ（全員が質問すると尋問になる）', () => {
    expect(reactDirective({ charaId: 'rinku', ...sore })).not.toMatch(/問いを返す/);
    expect(reactDirective({ charaId: 'konta', ...sore })).not.toMatch(/問いを返す/);
  });

  it('急所が無ければ何も足さない（プロンプトを無駄に長くしない）', () => {
    expect(reactDirective({ charaId: 'tanunee', point: null, kind: 'none' })).toBe('');
  });
});

describe('★刺さりすぎを止める（逃げ道を一つ残す）', () => {
  it('問いを返すのは通す（これが「反応したくなる」の要）', () => {
    expect(checkNotTooHarsh('で、次に同じことするつもり？').ok).toBe(true);
  });

  it('★決めつけは止める（逃げ道を塞ぐ）', () => {
    expect(checkNotTooHarsh('向いてないと思う').ok).toBe(false);
    expect(checkNotTooHarsh('やめた方がいい').ok).toBe(false);
  });

  it('★人格の否定は止める', () => {
    expect(checkNotTooHarsh('そういう所が問題').ok).toBe(false);
  });

  it('★命令は止める', () => {
    expect(checkNotTooHarsh('もうやめろ').ok).toBe(false);
  });

  it('ふつうの受け止めは通す', () => {
    expect(checkNotTooHarsh('増えない時期、あるよね').ok).toBe(true);
  });
});

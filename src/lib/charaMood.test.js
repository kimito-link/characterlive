/**
 * charaMood.test.js / 返事の長さ — 「何時間でも話したくなる」ための性質を固定する。
 *
 * ★ユーザー要望(2026-09-04):
 *   「急かされない」「わかってくれる感」「短さ。長すぎると機械っぽくなる」
 */
import { describe, it, expect } from 'vitest';
import { readMood, moodDirective } from './charaMood.js';
import { limitSentences, tidy, MAX_SENTENCES } from './charaBrain.js';

describe('★返事は文の数で切る（長いと機械っぽくなる）', () => {
  // ★以前は文字数(60字)でしか見ておらず、短ければ4文でも5文でも通っていた。
  //   「長すぎる」のは字数ではなく文の数の問題だった。
  it('3文までにする', () => {
    const out = limitSentences('そうなんだ。すごいね。えらいね。がんばったね。よかったね。');
    expect((out.match(/[。！？!?]/g) || []).length).toBe(3);
  });

  it('3文以内ならそのまま', () => {
    const t = 'そりゃそうよ。でも、まだ配信切ってないじゃない。だったら続ければいいのよ。';
    expect(limitSentences(t)).toBe(t);
  });

  it('1文はそのまま（短いのは良いこと）', () => {
    expect(limitSentences('いいと思うのだ！')).toBe('いいと思うのだ！');
  });

  it('★3文目が続きを求める形なら4文目まで許す（途中で切ると意味が壊れる）', () => {
    const out = limitSentences('うん。わかった。でも、まだ続けられるよ。');
    expect(out).toContain('続けられる');
  });

  it('上限は3文', () => {
    expect(MAX_SENTENCES).toBe(3);
  });

  it('tidy を通しても文の数が守られる', () => {
    const out = tidy('はい、そうなんだ。すごいね。えらいね。がんばったね。よかったね。');
    expect((out.match(/[。！？!?]/g) || []).length).toBeLessThanOrEqual(MAX_SENTENCES + 1);
  });
});

describe('★その場の空気を読む（AIに読ませず、こちらで判定する）', () => {
  it('落ち込みを拾う', () => {
    expect(readMood([], '今日は視聴者0人だよ').mood).toBe('down');
    expect(readMood([], 'つらい、やめたい').mood).toBe('down');
  });

  it('上がっているのを拾う', () => {
    expect(readMood([], 'やったー！初めてコメントもらえた').mood).toBe('up');
  });

  it('どちらでもない時は平ら（無理に判定しない）', () => {
    expect(readMood([], '今日もいい天気だね').mood).toBe('flat');
  });

  it('★感情は持続する（1回の発言で切り替えない）', () => {
    // 「うん」だけでも、直前の「つらい」を引き継いで下向きに傾く
    const hist = [{ who: '配信者', text: '今日つらい' }];
    expect(readMood(hist, 'うん').score).toBeLessThan(0);
  });

  it('★りんくは落ち込みでも励ましを急がない（安全網の性質）', () => {
    expect(moodDirective('down', true)).toMatch(/受け止める/);
  });

  it('★他の子は落ち込みを茶化さない', () => {
    expect(moodDirective('down', false)).toMatch(/茶化さず/);
  });

  it('平らな時は何も足さない（プロンプトを無駄に長くしない）', () => {
    expect(moodDirective('flat', false)).toBe('');
  });
});

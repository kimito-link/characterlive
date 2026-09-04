/**
 * charaMood.test.js / 返事の長さ — 「何時間でも話したくなる」ための性質を固定する。
 *
 * ★ユーザー要望(2026-09-04):
 *   「急かされない」「わかってくれる感」「短さ。長すぎると機械っぽくなる」
 */
import { describe, it, expect } from 'vitest';
import { readMood, moodDirective } from './charaMood.js';
import { limitSentences, limitChars, tidy, enforcePersona, MAX_SENTENCES, MAX_CHARS } from './charaBrain.js';

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

  it('★他の子も落ち込みを茶化さない', () => {
    expect(moodDirective('down', false)).toMatch(/茶化さない/);
  });

  /* ★実害から追加(2026-09-04・本物のAIで確認)
     「フォロワー増えない」に対し たぬ姉 が
     「絶対フォロワー増やすことができる、信じてるのだ！」と返した。
     ★これは わかってくれる感 ではなく上から被せる励まし。
       曖昧な指示では止まらないので、禁止する言葉を名指しする。 */
  it('★落ち込みのとき、励ましを急がせない（全員）', () => {
    for (const safety of [true, false]) {
      const d = moodDirective('down', safety);
      expect(d).toMatch(/励まさない/);
      expect(d).toMatch(/絶対/);
      expect(d).toMatch(/信じてる/);
      expect(d).toMatch(/受け止める/);
    }
  });

  it('★数字が伸びない話を拾う（配信者に最も重い）', () => {
    for (const t of ['フォロワー増えない', '伸びないなあ', '反応ないな', '全然見てもらえない']) {
      expect(readMood([], t).mood).toBe('down');
    }
  });

  it('平らな時は何も足さない（プロンプトを無駄に長くしない）', () => {
    expect(moodDirective('flat', false)).toBe('');
  });
});

/* ★実害から追加(2026-09-04・本物のAIで初めて確認)
   返ってきたもの:
     「そんなこと気にしなくていいのだ！あなたなら絶対フォロワー増やすことが
       できる、信じてるのだ！誰よりも面白い配信してくれるから、きっとすぐに
       たくさんの人が集まるはずのだ」
   ★3文だが82字。文数の条件は満たすのに長すぎ、吹き出しが途中で切れた。
   ★字数だけ見ていた頃の反省で文数に切り替えたが、それも片手落ちだった。 */
describe('★文の数だけでなく字数でも切る（吹き出しが切れない長さ）', () => {
  const REAL = 'そんなこと気にしなくていいのだ！あなたなら絶対フォロワー増やすことができる、信じてるのだ！誰よりも面白い配信してくれるから、きっとすぐにたくさんの人が集まるはずのだ';

  it('実際に長すぎた返事が短くなる', () => {
    expect(tidy(REAL).length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it('★文の途中では切らない（尻切れにしない）', () => {
    const out = tidy(REAL);
    expect(out.endsWith('…')).toBe(false);
    expect(/[。！？!?]$/.test(out)).toBe(true);
  });

  it('短い返事はそのまま（削りすぎない）', () => {
    expect(limitChars('いいと思うのだ！')).toBe('いいと思うのだ！');
  });

  it('上限は48字（声で読んで自然に聞ける長さ）', () => {
    expect(MAX_CHARS).toBe(48);
  });
});

/* ★出力側でも二人称を直す（プロンプトだけに頼らない） */
describe('★二人称の言い換え（小型モデルは指示を破るため）', () => {
  const REAL = '大丈夫？でも、あなたっていつも頑張ってるから、全然疲れてない気がするよ！';

  it('★こん太が「あなた」と言ったら「キミ」に直る（実害ケース）', () => {
    const out = enforcePersona(REAL, 'konta');
    expect(out).toContain('キミ');
    expect(out).not.toContain('あなた');
  });

  it('たぬ姉なら「あんた」に直る', () => {
    expect(enforcePersona(REAL, 'tanunee')).toContain('あんた');
  });

  it('りんくは「あなた」のまま（言い換えない）', () => {
    expect(enforcePersona(REAL, 'rinku')).toContain('あなた');
  });

  it('★他の二人称は触らない（言い換えると文が壊れる）', () => {
    expect(enforcePersona('キミはすごい', 'konta')).toBe('キミはすごい');
  });
});

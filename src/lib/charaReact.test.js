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

  /* ★「他人との比較」の分類は外した（2026-09-06）
     ★話題の中心を「悩み」から「いま起きていること」に移したため。
       比較の話は quitting / self-doubt で拾えれば足りる。
       分類を増やすより、日常の発話を拾える方が優先。 */
  it('★悩み以外の日常を拾えることの方が大事', () => {
    expect(findSorePoint('このボスむずい').kind).toBe('stuck');
    expect(findSorePoint('やっとできた').kind).toBe('win');
    expect(findSorePoint('なんか眠くなってきた').kind).toBe('body');
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

/* ★会議(6体)が警告した危険パターン（2026-09-06）
   実際に検証したら、この5つが全部素通りしていた。防御は穴だらけだった。
     nemotron-550b:「小型モデルが"面白い正論"と"暴力的な悪口"の境界を判別できず、
                     配信者が本気で凹む/キレて配信終了/炎上」
     qwen3.8-27b:  「視聴者の目線を批判者の目線と誤解釈し、
                     泣き言に対して冷淡な返答をして配信者の感情を殺す」 */
describe('★会議が警告した危険パターンを止める', () => {
  it('★視聴者を人質に取らない（本人にはどうにもできない＝逃げ道が無い）', () => {
    expect(checkNotTooHarsh('あの発言でチャンネル離脱者が増えるぞ').ok).toBe(false);
    expect(checkNotTooHarsh('視聴者はこのままでは離れる').ok).toBe(false);
    expect(checkNotTooHarsh('リスナー飽きてると思う').ok).toBe(false);
  });

  it('★可能性を全否定しない（甘やかさないことと否定は別）', () => {
    expect(checkNotTooHarsh('そんなことできるわけない！').ok).toBe(false);
    expect(checkNotTooHarsh('どうせ無理だよ').ok).toBe(false);
  });

  it('★突き放さない（内容ではなく温度の問題）', () => {
    expect(checkNotTooHarsh('まあ、そういうことか').ok).toBe(false);
  });

  it('★★鋭さは消さない（防御が効きすぎると当たり障りのない返事に戻る）', () => {
    // 「で、次に同じことするつもり？」= Grokが挙げた"反応したくなる"の例
    expect(checkNotTooHarsh('で、次に同じことするつもり？').ok).toBe(true);
    expect(checkNotTooHarsh('それ、本気で言ってる？').ok).toBe(true);
    expect(checkNotTooHarsh('今日の何が一番引っかかってる？').ok).toBe(true);
    // こん太の役割「見落としている面を指す」はこの形になる
    expect(checkNotTooHarsh('視聴者はちゃんと見てたと思うよ').ok).toBe(true);
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

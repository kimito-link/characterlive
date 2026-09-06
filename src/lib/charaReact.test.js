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

/* ★★分類を減らした（2026-09-06・ユーザー判断）
   体験価値の3本柱に照らすと、分類を増やすことは
   ③「予測が外れる」と**逆方向**だった。
   分類が細かいほど、返答は分類に沿った予測可能なものになる。

   ★経緯: 最初は「増えない/0人」だけ拾っていた（製品の芯と矛盾）。
     指摘を受けてゲーム語を足し、雑談・作業も足し、分類は9種類に増えた。
     ★増やすほど「その分類らしい返事」しか出なくなる。枠を広げても檻は檻。
   → 拾うのは**言葉そのもの**だけ。返し方はモデル（人格）に委ねる。 */
describe('★拾うのは言葉だけ（分類しない）', () => {
  it('相手が言った語を拾う', () => {
    expect(findSorePoint('このボスむずい').point).toBe('むずい');
    expect(findSorePoint('やっとできた').point).toBe('できた');
    expect(findSorePoint('なんか眠くなってきた').point).toBe('眠');
    expect(findSorePoint('もうやめたい').point).toBe('やめたい');
  });

  it('★何をしていても拾える（配信・作業・雑談を問わない）', () => {
    expect(findSorePoint('ここ難しいんだよね').point).toBeTruthy();   // 作業
    expect(findSorePoint('どっちの色がいいかな').point).toBeTruthy(); // お絵かき
    expect(findSorePoint('お腹すいた').point).toBeTruthy();           // 日常
  });

  it('無ければ拾わない（無理に探すと関係ない語に反応する）', () => {
    expect(findSorePoint('今日はいい天気').point).toBe(null);
  });

  it('★分類は返さない（kind に意味を持たせない）', () => {
    const a = findSorePoint('このボスむずい');
    const b = findSorePoint('やっとできた');
    expect(a.kind).toBe(b.kind);   // 同じ。分類していない証拠
  });
});

describe('★指示は1行だけ（型を決めない）', () => {
  const sore = findSorePoint('このボスむずい');

  it('相手が言った言葉を渡すだけ', () => {
    expect(reactDirective({ charaId: 'rinku', ...sore })).toBe('相手は「むずい」と言った。そこに反応する。');
  });

  it('★3人とも同じ指示（返し方は人格が決める）', () => {
    const a = reactDirective({ charaId: 'rinku', ...sore });
    const b = reactDirective({ charaId: 'konta', ...sore });
    const c = reactDirective({ charaId: 'tanunee', ...sore });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('★返し方を指定しない（「問いを返せ」等を書かない）', () => {
    const d = reactDirective({ charaId: 'tanunee', ...sore });
    expect(d).not.toMatch(/問いを返す/);
    expect(d).not.toMatch(/言いにくいこと/);
    expect(d).not.toMatch(/見ていない面/);
  });

  it('拾えなければ何も足さない', () => {
    expect(reactDirective({ charaId: 'rinku', point: null, kind: 'none' })).toBe('');
  });
});

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

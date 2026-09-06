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
/* ★語マッチは廃止した（2026-09-06・実害）
   実害:「配信ってどう【やった】らうまくなる？」→ りんく「やったね、素晴らしいのだ！」
   ★同じ構造で8件中6件が誤爆した。特に否定形を肯定として拾っていた:
     「痛くないよ」→"痛" /「眠くない？」→"眠" /「難しくないよ」→"難し"
   ★日本語の否定・活用を正規表現で扱うのが無理筋だった。
   → 廃止。人格(system プロンプト231字)に委ねる。 */
describe('★語マッチを復活させない（誤爆の温床）', () => {
  it('★何も拾わない', () => {
    for (const t of ['配信ってどうやったらうまくなる？', '痛くないよ', '眠くない？',
                     '難しくないよ', '終わったあとに何する？', 'このボスむずい']) {
      expect(findSorePoint(t).point).toBe(null);
    }
  });

  it('★プロンプトに何も足さない（返し方は人格が決める）', () => {
    expect(reactDirective()).toBe('');
    expect(reactDirective({ charaId: 'rinku', point: 'むずい' })).toBe('');
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

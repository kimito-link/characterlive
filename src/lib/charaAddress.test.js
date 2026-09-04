/**
 * charaAddress.test.js — 名指しの扱いを固定する。
 *
 * ★設計はGrok本人に相談して確定した（2026-09-05）。回答の要点:
 *   「『たぬ姉の言うとおりだ』は同意であって質問ではない。たぬ姉が1文だけ受ける。
 *     新しい意見は出さない。他の2人は黙る。
 *     ★すぐ誰かが拾うと、同意を会議にする」
 *   「履歴は全部渡さない。渡すのは4つだけ。
 *     ★それ以上足すと小型モデルは要約し始める」
 *   「指名されていない2人は声を出さない。相槌も打たない。
 *     ★配信の横だと、短い『うん』でもうるさい」
 */
import { describe, it, expect } from 'vitest';
import { readAddress, narrowContext, addressDirective, silentMembers } from './charaAddress.js';
import { buildSystemPrompt } from './charaPersona.v1.js';

describe('★「同意」と「質問」を区別する', () => {
  it('「こん太、どう思う？」は質問', () => {
    expect(readAddress('こん太、どう思う？')).toEqual({ kind: 'question', charaId: 'konta' });
  });

  it('★「たぬ姉の言うとおりだ」は同意（質問ではない）', () => {
    expect(readAddress('たぬ姉の言うとおりだ')).toEqual({ kind: 'agree', charaId: 'tanunee' });
  });

  it('「〜もそう思う」「〜に賛成」も同意', () => {
    expect(readAddress('たぬ姉もそう思う').kind).toBe('agree');
    expect(readAddress('りんくに賛成').kind).toBe('agree');
  });

  it('名前が無ければ none', () => {
    expect(readAddress('今日は疲れた').kind).toBe('none');
  });
});

describe('★同意には新しい意見を足さない（同意を会議にしない）', () => {
  it('受けるだけにする指示が入る', () => {
    const d = addressDirective({ kind: 'agree', charaId: 'tanunee' });
    expect(d).toMatch(/受けるだけ/);
    expect(d).toMatch(/新しい意見を足さない/);
  });

  it('同意のときは直前の1文を踏まえない（蒸し返さない）', () => {
    const d = addressDirective({
      kind: 'agree', charaId: 'tanunee', prevName: 'りんく', prevLine: 'そうなのだ'
    });
    expect(d).not.toMatch(/直前に仲間が/);
  });
});

describe('★渡す文脈は4つだけ（小型モデルに要約させない）', () => {
  const hist = [
    { who: '配信者', text: 'つかれた' },
    { who: 'たぬ姉', text: 'まあ休みなさい。無理しても続かないもの。' }
  ];

  it('直前に喋った子と、その最後の1文だけを拾う', () => {
    const c = narrowContext({ text: 'りんく、どう思う？', charaId: 'rinku', history: hist });
    expect(c.prevName).toBe('たぬ姉');
    expect(c.prevLine).toBe('まあ休みなさい。');   // ★1文だけ（全文ではない）
    expect(c.selfName).toBe('りんく');
  });

  it('自分の発言まで遡ったら止める（自分の言葉を"仲間の発言"にしない）', () => {
    const h = [{ who: 'りんく', text: 'いいと思うのだ' }, { who: '配信者', text: 'うん' }];
    expect(narrowContext({ text: 'りんく、どう思う？', charaId: 'rinku', history: h }).prevName)
      .toBe(null);
  });
});

describe('★直前の1文を踏まえるが、繰り返さない', () => {
  it('指示に「繰り返さない」が入る', () => {
    const d = addressDirective({
      kind: 'question', charaId: 'rinku', prevName: 'たぬ姉', prevLine: 'まあ休みなさい。'
    });
    expect(d).toMatch(/繰り返さず/);
    expect(d).toMatch(/まあ休みなさい/);
  });

  it('★引用は24字までに切る（プロンプト上限を超えないため）', () => {
    const long = 'あ'.repeat(100);
    const d = addressDirective({
      kind: 'question', charaId: 'rinku', prevName: 'たぬ姉', prevLine: long
    });
    expect(d).not.toContain('あ'.repeat(25));
  });
});

describe('★役割ごとに答え方が違う（同じ質問に3人が違う答え）', () => {
  it('りんくは受け止める（肯定ではない）', () => {
    expect(addressDirective({ kind: 'question', charaId: 'rinku' })).toMatch(/受け止める/);
  });
  it('こん太はずらす', () => {
    expect(addressDirective({ kind: 'question', charaId: 'konta' })).toMatch(/ずらす/);
  });
  it('たぬ姉は閉じる', () => {
    expect(addressDirective({ kind: 'question', charaId: 'tanunee' })).toMatch(/閉じる/);
  });
  it('★長さは揃える（全員1文）', () => {
    for (const id of ['rinku', 'konta', 'tanunee']) {
      expect(addressDirective({ kind: 'question', charaId: id })).toMatch(/1文だけ/);
    }
  });
});

describe('★指名されていない子は黙る（相槌も打たない）', () => {
  it('名指しされた子以外の2人を返す', () => {
    expect(silentMembers('tanunee')).toEqual(['rinku', 'konta']);
  });
});

describe('★プロンプト上限を超えない（最悪ケースでも）', () => {
  it('落ち込み＋名指し＋長い引用でも300字以内', () => {
    const d = addressDirective({
      kind: 'question', charaId: 'rinku', prevName: 'たぬ姉', prevLine: 'あ'.repeat(80)
    });
    const p = buildSystemPrompt('rinku', {
      mode: 'cheer',
      situation: d   // ★名指し時は mood と重ねない（重ねると上限を超える）
    });
    // 実測: AIは320〜350字で create が失敗する
    expect(p.length).toBeLessThanOrEqual(300);
  });
});

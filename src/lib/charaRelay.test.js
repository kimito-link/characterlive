/**
 * charaRelay.test.js — 3人リレーの条件を固定する（2026-09-05 ユーザー指示）。
 */
import { describe, it, expect } from 'vitest';
import {
  isHeartTalk, relayMembers, relayDirective, checkRelayLine,
  RELAY_ORDER, RELAY_MAX_SENTENCES
} from './charaRelay.js';

describe('★リレーの順番と人数は固定', () => {
  it('りんく → こん太 → たぬ姉', () => {
    expect(RELAY_ORDER).toEqual(['rinku', 'konta', 'tanunee']);
    expect(relayMembers(3)).toEqual(['rinku', 'konta', 'tanunee']);
  });

  it('最大3人（4人目はいない）', () => {
    expect(relayMembers(9).length).toBe(3);
  });

  it('リレー中は1人1文', () => {
    expect(RELAY_MAX_SENTENCES).toBe(1);
  });
});

describe('★リレーを出す条件は絞る（全員が毎ターン喋る失敗に戻さない）', () => {
  it('録画で使う入力ではリレーになる', () => {
    expect(isHeartTalk('恥ずかしくてあんまり言えないけど、みんなのこと好き。安定剤みたい。自分もそうなりたい。'))
      .toBe(true);
  });

  it('短い相槌では出ない', () => {
    expect(isHeartTalk('つかれた')).toBe(false);
    expect(isHeartTalk('うん')).toBe(false);
  });

  it('★事実の質問では出ない（3人で囲まない）', () => {
    expect(isHeartTalk('これどうやるの？')).toBe(false);
  });

  it('打ち明け＋変わりたい、が揃えば出る', () => {
    expect(isHeartTalk('正直、辛いけど変わりたい')).toBe(true);
  });
});

/* ★役割は「口調」ではなく「判断基準」で書く（2026-09-06・Grokの助言）
   Grok:「役割を"性格のラベル"にした時点で、予測可能装置になっている。
          誰が話すか分かった瞬間に内容もほぼ読める」
   ★以前は「受け止める」「ずらす」「閉じる」＝何を言うかまで固定だった。
     さらに「励まさない」「助言しない」と禁止で埋めており、
     ★りんくは何もするなと指示されている状態だった。
   → 何をするかを書き、禁止は最小限にする。 */
describe('★役割は判断基準（口調ではない）', () => {
  it('りんくは気持ちを言葉にする（取り繕わない）', () => {
    const d = relayDirective('rinku', 0);
    expect(d).toMatch(/気持ちを言葉にする/);
    expect(d).toMatch(/取り繕わない/);
  });

  it('こん太は見落としを指す（ほめるのではない）', () => {
    const d = relayDirective('konta', 1);
    expect(d).toMatch(/見落としている面/);
    expect(d).toMatch(/ほめない/);
  });

  it('★たぬ姉は言いにくいことを言う（ただし人格は否定しない）', () => {
    const d = relayDirective('tanunee', 2);
    expect(d).toMatch(/言いにくいこと/);
    expect(d).toMatch(/人格は否定しない/);
  });

  it('★「何もしない」指示を入れない（当たり障りのない一言しか出なくなる）', () => {
    for (let i = 0; i < 3; i += 1) {
      const d = relayDirective(RELAY_ORDER[i], i);
      expect(d).not.toMatch(/助言しない/);
      expect(d).not.toMatch(/励まさない/);
    }
  });

  it('★全員に禁止が入る（好きの投げ返し・あらあら）', () => {
    for (let i = 0; i < 3; i += 1) {
      const d = relayDirective(RELAY_ORDER[i], i);
      expect(d).toMatch(/私も好き/);
      expect(d).toMatch(/あらあら/);
      expect(d).toMatch(/1文だけ/);   // ★長さは揃える（役割が変わっても）
    }
  });
});

describe('★出た文も検査する（プロンプトだけに頼らない）', () => {
  it('好きの投げ返しは落とす', () => {
    expect(checkRelayLine('私も好きだよ').ok).toBe(false);
    expect(checkRelayLine('ボクも好き！').ok).toBe(false);
  });

  it('「あらあら」は落とす', () => {
    expect(checkRelayLine('あらあら、そうなの').ok).toBe(false);
  });

  it('ふつうの受け止めは通す', () => {
    expect(checkRelayLine('言いにくいの、わかった').ok).toBe(true);
  });
});

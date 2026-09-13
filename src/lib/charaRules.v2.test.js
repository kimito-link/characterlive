import { describe, it, expect } from 'vitest';
import { SHARED_RULES_V2, ROLE_RULES_V2, roleRulesV2 } from './charaRules.v2.js';
import { PERSONA_IDS } from './charaPersona.v1.js';

describe('charaRules.v2 — 役ごとの振る舞い規則（クラウド頭脳用）', () => {
  it('3人ぶん全員に役の規則がある（v1 の id と一致）', () => {
    for (const id of PERSONA_IDS) {
      expect(typeof ROLE_RULES_V2[id]).toBe('string');
      expect(ROLE_RULES_V2[id].length).toBeGreaterThan(40);
    }
  });

  it('役の分担が本調査の採用・禁止と一致する', () => {
    expect(ROLE_RULES_V2.rinku).toContain('1つだけ拾う');        // 採用5: 記憶は1つ
    expect(ROLE_RULES_V2.rinku).toContain('全肯定の連打');        // 禁止3: 褒めすぎ
    expect(ROLE_RULES_V2.konta).toContain('オウム返しだけ');      // 採用2: 繰り返さない
    expect(ROLE_RULES_V2.konta).toContain('3回まで');            // 相槌の連続に上限
    expect(ROLE_RULES_V2.tanunee).toContain('結論を先に');        // 採用1: 判定一語で始める
    expect(ROLE_RULES_V2.tanunee).toContain('人格否定');          // 6項目ゲートと同じ線
  });

  it('共通規則に、引き止めない・別人にならない・メタを声に出さない、がある', () => {
    expect(SHARED_RULES_V2).toContain('引き止めない');           // 禁止2
    expect(SHARED_RULES_V2).toContain('別人にならない');         // Grok 禁止3: トーン変質
    expect(SHARED_RULES_V2).toContain('声に出さない');           // Grok 禁止7: メタ読み上げ
    expect(SHARED_RULES_V2).toContain('二度使わない');           // 禁止1
  });

  it('roleRulesV2 は共通＋役を返し、知らない id なら共通だけ', () => {
    const r = roleRulesV2('rinku');
    expect(r.startsWith(SHARED_RULES_V2)).toBe(true);
    expect(r).toContain(ROLE_RULES_V2.rinku);
    expect(roleRulesV2('nobody')).toBe(SHARED_RULES_V2);
  });

  it('★内蔵AIには入らない長さである（=クラウド専用だと分かる）', () => {
    // 内蔵AIの system 上限は実測 320〜350字。これを超えるので v1 の system には混ぜない。
    expect(roleRulesV2('konta').length).toBeGreaterThan(350);
  });
});

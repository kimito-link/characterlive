/**
 * charaPersona.test.js — 人格プロンプトの回帰防止。
 */
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, PERSONA_IDS, PERSONAS, MODES } from './charaPersona.v1.js';

/*
 * ★プロンプトの長さ上限（2026-09-04 実測で確定・最重要）
 *
 *   Chrome内蔵AI(LanguageModel)は system が長いと create が
 *   "The input is too large." で失敗する。
 *   実測: 320字=通る / 350字=失敗 → 上限は 320〜350 のあたり。
 *
 *   ★実際に踏んだ不具合: system が518字あり、AIが有効な環境では**毎回失敗**して
 *     決め打ちの返事に落ちていた。画面には available と出るので気づきにくかった。
 *   → 安全側に 250字 を上限とする。人格を足したくなったら、どこかを削る。
 */
const MAX_SYSTEM_CHARS = 250;

describe('★systemプロンプトは短く保つ（長いとAPIに拒否される）', () => {
  for (const id of PERSONA_IDS) {
    for (const mode of Object.keys(MODES)) {
      it(`${id} / ${mode} は ${MAX_SYSTEM_CHARS}字以内`, () => {
        expect(buildSystemPrompt(id, { mode }).length).toBeLessThanOrEqual(MAX_SYSTEM_CHARS);
      });
    }
  }

  it('状況を足しても上限を超えない', () => {
    const p = buildSystemPrompt('tanunee', { mode: 'blunt', situation: '長時間コメントが無い' });
    expect(p.length).toBeLessThanOrEqual(MAX_SYSTEM_CHARS + 40);
  });
});

describe('★人格の要点は削らない（短縮しても残すもの）', () => {
  it('自分の名前は入る', () => {
    for (const id of PERSONA_IDS) {
      expect(buildSystemPrompt(id)).toContain(PERSONAS[id].displayName);
    }
  });

  it('★他の子の名前は入らない（呼び間違いの材料を渡さない）', () => {
    for (const id of PERSONA_IDS) {
      const p = buildSystemPrompt(id);
      for (const other of PERSONA_IDS) {
        if (other === id) continue;
        expect(p).not.toContain(PERSONAS[other].displayName);
      }
    }
  });

  it('★相手を人名で呼ばない指示は残っている', () => {
    for (const id of PERSONA_IDS) {
      expect(buildSystemPrompt(id)).toMatch(/人名で呼ばない/);
    }
  });

  it('りんくの語尾指示は残っている（口調は人格の芯）', () => {
    expect(buildSystemPrompt('rinku')).toContain('のだ');
  });

  it('りんくは安全網であり続ける（毒舌モードでも否定しない）', () => {
    expect(buildSystemPrompt('rinku', { mode: 'blunt' })).toMatch(/否定しない/);
  });

  it('短く答える指示は残っている（声で読むため）', () => {
    for (const id of PERSONA_IDS) {
      expect(buildSystemPrompt(id)).toMatch(/1〜2文/);
    }
  });
});

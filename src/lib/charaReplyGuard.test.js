import { describe, it, expect } from 'vitest';
import { looksBrokenReply } from './charaReplyGuard.js';

describe('looksBrokenReply — 返事の形をした失敗を見抜く', () => {
  it('実害の再現: 英語のエラー文を返事扱いしない', () => {
    const r = looksBrokenReply('On-device model is not available in Chromium, try again later.');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('英字');
  });

  it('実害の再現: プロンプトの足場を復唱したら失敗', () => {
    expect(looksBrokenReply('これまでの会話: 相手: 今日配信したんだけど').ok).toBe(false);
    expect(looksBrokenReply('場の話（直近）:\n港区の話').ok).toBe(false);
  });

  it('渡した user の先頭をそのまま返したら失敗', () => {
    const user = '相手:「今日配信したんだけど、コメント0だった」\n\nりんくとして返して';
    expect(looksBrokenReply('相手:「今日配信したんだけど、コメント0だった」', user).ok).toBe(false);
  });

  it('普通の返事は通す（英字が少し混ざっても・短くても）', () => {
    expect(looksBrokenReply('いいのだ！VOICEVOX も動いてるのだ').ok).toBe(true);
    expect(looksBrokenReply('うん').ok).toBe(true);
    expect(looksBrokenReply('OK！').ok).toBe(true);   // 短い英字は許す
  });

  it('★Grok の正解は落とさない（内容で判断しない）', () => {
    const r = looksBrokenReply('若い女に攻撃するおっさん、きついよね。君が守ってあげたいって思う気持ち、わかる');
    expect(r.ok).toBe(true);
  });

  it('文字列でない・空は失敗', () => {
    expect(looksBrokenReply(undefined).ok).toBe(false);
    expect(looksBrokenReply('   ').ok).toBe(false);
  });
});

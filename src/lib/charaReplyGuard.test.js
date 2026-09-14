import { describe, it, expect } from 'vitest';
import { looksBrokenReply, isRepeatOf, isEchoOf } from './charaReplyGuard.js';

describe('isEchoOf — キャラの台詞の後半だけを拾った反響を見抜く', () => {
  const spoken = '「大丈夫」って言葉は、時に重すぎるのよ。相手の気持ちを尊重して、本当に必要な言葉を贈って。';
  it('★実害の再現: 台詞の後半だけ（全体比率では 0.43 で通っていた）', () => {
    expect(isRepeatOf(spoken, 'の気持ちを尊重して本当に必要な言葉を送って', 0.5)).toBe(false);   // 旧判定は通す
    expect(isEchoOf('の気持ちを尊重して本当に必要な言葉を送って', spoken)).toBe(true);           // 新判定は捕まえる
    expect(isEchoOf('本当に必要な言葉を送って', spoken)).toBe(true);
    expect(isEchoOf('言葉は魔法じゃない ただ相手の心に届くかどうか', '言葉は、魔法じゃない。ただ、相手の心に届くかどうか。')).toBe(true);
  });
  it('本人の別の言葉は通す（同じ話題でも）', () => {
    expect(isEchoOf('大丈夫って言われても不安なんだよね', spoken)).toBe(false);
    expect(isEchoOf('今日はこれからゲームするよ', spoken)).toBe(false);
  });
  it('短い言葉は判定しない（「うん」「大丈夫」が台詞に含まれていても捨てない）', () => {
    expect(isEchoOf('大丈夫', spoken)).toBe(false);
    expect(isEchoOf('うん', spoken)).toBe(false);
  });
});

describe('isRepeatOf — 直前の自分の返事の使い回しを見抜く（比率で判定）', () => {
  it('同じ文はもちろん、句読点だけ違う文も繰り返し', () => {
    expect(isRepeatOf('画面は見えない。音声モードだから、画面は見えない', '画面は見えない！音声モードだから画面は見えない')).toBe(true);
  });

  it('★Grok の実害: 食い下がられて同じ説明を返した', () => {
    const a = '見えない。音声モードでは画面を受け取る仕組みがない。何が出てるか、言葉で教えてくれれば一緒に確認する';
    const b = '見えない。音声モードでは画面を受け取る仕組みがない。何が出てるか言葉で教えてくれれば一緒に確認する';
    expect(isRepeatOf(a, b)).toBe(true);
  });

  it('同じ話題でも別の文なら繰り返しではない', () => {
    expect(isRepeatOf('コメント0か。そういう日もあるのだ', '3人減ったのは気になるのだ。心当たりある？')).toBe(false);
    expect(isRepeatOf('いいのだ！やってみるのだ', 'ボクは待ってるのだ')).toBe(false);
  });

  it('短い相槌同士は繰り返しと呼ばない（「うん」が続いてもよい）', () => {
    expect(isRepeatOf('うん', 'うん')).toBe(true);        // 完全一致だけは true
    expect(isRepeatOf('うんうん', 'うん、そう')).toBe(false);
  });

  it('空や未定義は false', () => {
    expect(isRepeatOf('', 'なにか')).toBe(false);
    expect(isRepeatOf(undefined, undefined)).toBe(false);
  });
});

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

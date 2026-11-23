import { describe, it, expect } from 'vitest';
import {
  buildRoomDigest, roomAsk, roomForcesOneSentence, buildUserBlock,
  DIGEST_CHARS_NANO, DIGEST_CHARS_CLOUD
} from './charaDigest.js';

describe('buildRoomDigest — 窓を頭脳ごとの長さに切る', () => {
  it('内蔵AIは末尾140字、クラウドは末尾800字を残す（要約しない）', () => {
    const w = 'あ'.repeat(1000) + '末尾';
    const nano = buildRoomDigest({ window: w, brain: 'nano' });
    const cloud = buildRoomDigest({ window: w, brain: 'fable' });
    expect(nano.length).toBe(DIGEST_CHARS_NANO);
    expect(cloud.length).toBe(DIGEST_CHARS_CLOUD);
    expect(nano.endsWith('末尾')).toBe(true);
    expect(cloud.endsWith('末尾')).toBe(true);
  });

  it('短ければそのまま。空なら空', () => {
    expect(buildRoomDigest({ window: '港区の話でさ／ああとかね' })).toBe('港区の話でさ／ああとかね');
    expect(buildRoomDigest({ window: '  ' })).toBe('');
    expect(buildRoomDigest(undefined)).toBe('');
  });
});

describe('roomAsk — 場の合間に一言、と頼む', () => {
  it('1文・いまのこと・実況しない・なぞらない、が入る', () => {
    const a = roomAsk('りんく');
    expect(a).toContain('りんくとして');
    expect(a).toContain('合間の掛け声か一言ツッコミ');
    expect(a).toContain('主役は奪わない');
    expect(a).toContain('1文、20〜30字');
    expect(a).toContain('いまのことだけ');
    expect(a).toContain('説明・要約・実況はしない');
    expect(a).toContain('なぞらない');
    expect(a).toContain('提案しない');
    expect(a).toContain('褒めすぎない');
    expect(a).not.toContain('1〜2文');
  });

  it('役ごとに一言の型が違う（温かい受け／掛け声／結論のツッコミ）', () => {
    expect(roomAsk('りんく')).toContain('したことを1つ認め、事実は曲げない');
    expect(roomAsk('こん太')).toContain('掛け声だけ。解決しない');
    expect(roomAsk('たぬ姉')).toContain('結論を先に。相手は責めない');
    expect(roomAsk('だれか')).not.toContain('結論を先に');
  });

  it('内蔵AIの入力上限を圧迫しない長さに収める', () => {
    // 窓140＋履歴3ターンのあとでも指示が長すぎると create が落ちる（実測320〜350字）。
    expect(roomAsk('りんく').length).toBeLessThanOrEqual(100);
    expect(roomAsk('たぬ姉', { pickup: '守' }).length).toBeLessThanOrEqual(120);
  });

  it('pickup があれば触れるよう頼む', () => {
    expect(roomAsk('たぬ姉', { pickup: '守' })).toContain('「守」に触れる');
    expect(roomAsk('たぬ姉')).not.toContain('に触れる');
  });
});

describe('roomForcesOneSentence — 場だけ1文。1対1は切らない', () => {
  it('場があれば true、無ければ false', () => {
    expect(roomForcesOneSentence({ digest: '窓' })).toBe(true);
    expect(roomForcesOneSentence(false)).toBe(false);
    expect(roomForcesOneSentence(null)).toBe(false);
    expect(roomForcesOneSentence(undefined)).toBe(false);
  });
});

describe('buildUserBlock — 場モードでは断片を主役にしない', () => {
  it('room があると「相手:「…」」行を作らない', () => {
    const u = buildUserBlock({
      text: 'じゃないですか',
      hist: '相手: 港区の話\nあなた: へえ',
      ask: 'りんくとして一言',
      room: { digest: '港区の話でさ／ああとかね／じゃないですか' }
    });
    expect(u).not.toContain('相手:「');
    expect(u.startsWith('場の話（直近）:\n港区の話でさ')).toBe(true);
    expect(u).toContain('これまでの会話:\n相手: 港区の話');
    expect(u.trim().endsWith('りんくとして一言')).toBe(true);
  });

  it('room が無ければ従来どおり「相手:「…」」を主役にする', () => {
    const u = buildUserBlock({ text: 'こんにちは', hist: '', ask: '返して' });
    expect(u).toBe('相手:「こんにちは」\n\n返して');
    const u2 = buildUserBlock({ text: 'こんにちは', hist: '相手: やあ', ask: '返して' });
    expect(u2).toBe('これまでの会話:\n相手: やあ\n\n相手:「こんにちは」\n\n返して');
  });

  it('room の digest が空なら1対1扱い（空の場で場モードにならない）', () => {
    const u = buildUserBlock({ text: 'やあ', ask: 'x', room: { digest: '' } });
    expect(u).toContain('相手:「やあ」');
  });
});

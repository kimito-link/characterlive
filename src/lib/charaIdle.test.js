/**
 * charaIdle.test.js — 「黙る」設計を固定する。
 *
 * ★このテストが守っているもの（2026-09-04・Grokに相談して確定）
 *   「配信者向けなら急かさない方が正義。プロンプトだけでは急かしは直らない。
 *     タイマーと発話権が先」
 *   → ★間隔を短くする"改善"は、この製品では**劣化**。テストで止める。
 */
import { describe, it, expect } from 'vitest';
import { shouldSpeakUp, isSafeIdleLine, IDLE_DEFAULTS } from './charaIdle.js';

const NOW = 1_000_000;
const base = { now: NOW, lastUserSpokeAt: null, lastSelfSpokeAt: null };

describe('shouldSpeakUp — 既定は黙る', () => {
  it('相手が喋っている間は割り込まない', () => {
    const r = shouldSpeakUp({ ...base, lastUserSpokeAt: NOW - 99999, userIsSpeaking: true });
    expect(r.speak).toBe(false);
    expect(r.reason).toBe('user-speaking');
  });

  it('返事を作っている最中は喋らない', () => {
    const r = shouldSpeakUp({ ...base, lastUserSpokeAt: NOW - 99999, isThinking: true });
    expect(r.speak).toBe(false);
  });

  it('相手が喋り終わった直後は間を置く（続きがあるかもしれない）', () => {
    expect(shouldSpeakUp({ ...base, lastUserSpokeAt: NOW - 1000 }).reason).toBe('just-spoke');
  });

  it('★静かになりきる前は喋らない（ここを短くすると"急かす"になる）', () => {
    const r = shouldSpeakUp({ ...base, lastUserSpokeAt: NOW - 20000 });
    expect(r.speak).toBe(false);
    expect(r.reason).toBe('not-quiet-yet');
  });

  it('十分に静かなら自分から一言だけ言ってよい（0人配信で独りにしないため）', () => {
    expect(shouldSpeakUp({ ...base, lastUserSpokeAt: NOW - 50000 }).speak).toBe(true);
  });

  it('★連投しない（空気が読めていない筆頭）', () => {
    const r = shouldSpeakUp({ ...base, lastUserSpokeAt: NOW - 50000, lastSelfSpokeAt: NOW - 10000 });
    expect(r.speak).toBe(false);
    expect(r.reason).toBe('cooldown');
  });

  it('切れば完全に黙る（緊急停止の土台）', () => {
    expect(shouldSpeakUp({ ...base, lastUserSpokeAt: NOW - 99999, enabled: false }).speak).toBe(false);
  });
});

describe('★間隔の既定値を短くさせない（回帰防止）', () => {
  // ★実装済みだった「9〜20秒ごとに喋る」に戻すと、先行者が実証した失敗を踏む:
  //   kazuya_bros「ランダムに割り込まれると配信のテンポが非常に悪くなる」
  it('沈黙の待ち時間は30秒以上ある', () => {
    expect(IDLE_DEFAULTS.quietMs).toBeGreaterThanOrEqual(30000);
  });
  it('連投の間隔は60秒以上ある', () => {
    expect(IDLE_DEFAULTS.cooldownMs).toBeGreaterThanOrEqual(60000);
  });
  it('一度に喋るのは1人だけ（全員が毎ターン喋ると個性が消える）', () => {
    expect(IDLE_DEFAULTS.maxSpeakers).toBe(1);
  });
});

describe('isSafeIdleLine — 自分から言うときは答えを求めない', () => {
  it('★疑問形は出さない（返事の義務を作るのが"急かす"の正体）', () => {
    expect(isSafeIdleLine('元気してる？')).toBe(false);
    expect(isSafeIdleLine('今日はどんな配信するの？')).toBe(false);
    expect(isSafeIdleLine('大丈夫ですか')).toBe(false);
  });

  it('短い相槌は出してよい', () => {
    expect(isSafeIdleLine('うんうん')).toBe(true);
    expect(isSafeIdleLine('いい感じだね')).toBe(true);
  });

  it('長い独白は出さない（一言だけ）', () => {
    expect(isSafeIdleLine('ボクはね、さっきからずっと見てたんだけど今日の配信はいいと思うのだ')).toBe(false);
  });

  it('空文字は出さない', () => {
    expect(isSafeIdleLine('')).toBe(false);
  });
});

/*
 * ★発話権は1つであること（2026-09-04・Grokの警告に対する回帰防止）
 *
 *   Grokの指摘:
 *     「1人ずつ発話権を取る部品と、3本の独立タイマーが同居すると、また全員が喋り出す」
 *     「★再武装も同じ穴。喋ったあとに『次の45秒/90秒』を各キャラが自分でセットしてたら、
 *       結局3本に戻る。起こすのは仲裁役1つだけ」
 *
 *   現状は正しい（rAF/タイマー1本 + lastChatterAt という共有変数1つ）。
 *   ★これは**壊れやすい正しさ**なので、構造そのものをテストで固定する。
 *   「キャラごとに次の時刻を持たせる」改修は、ここで落ちる。
 */
import { readFileSync } from 'node:fs';

describe('★発話権は1つ（3本に戻さない）', () => {
  const controller = readFileSync(
    new URL('./charaLiveController.js', import.meta.url),
    'utf-8'
  );
  // コメント中の記述で誤判定しないよう、コメントを外してから調べる。
  const code = controller
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('setInterval を使わない（キャラごとに回すと3本になる）', () => {
    expect(code).not.toMatch(/setInterval\s*\(/);
  });

  it('★キャラのスロットに「次に喋る時刻」を持たせない（再武装は仲裁役だけ）', () => {
    expect(code).not.toMatch(/slots\[[^\]]+\]\.(nextChatterAt|nextAt|timer|timerId)/);
    expect(code).not.toMatch(/slot\.(nextChatterAt|nextAt|timer|timerId)/);
  });

  it('自発発話の時刻は1つの変数だけが持つ', () => {
    const decls = code.match(/let\s+lastChatterAt\b/g) || [];
    expect(decls.length).toBe(1);
  });
});

/*
 * ★2つの時計を混同しない（2026-09-04・Grok本人の助言を実装に落としたもの）
 *
 *   - REPLY_AFTER_SILENCE_MS (2秒) … 話しかけられて、いつ返事を始めるか
 *   - IDLE_DEFAULTS.quietMs (45秒) … 誰も何も言わないとき、いつ声をかけるか
 *
 *   Grok:「間は1.5〜2秒。3人いると誰かが必ず拾うから、長すぎると会話が死ぬ」
 *   Grok:「急かすのは silence 判定の短さで、存在感は別物」
 *   ★片方をもう片方に合わせる"統一"は劣化。ここで止める。
 */
import { REPLY_AFTER_SILENCE_MS } from './charaIdle.js';

describe('★返事の速さと、声をかける間隔は別の時計', () => {
  it('返事は2秒前後で始める（遅いと会話が死ぬ）', () => {
    expect(REPLY_AFTER_SILENCE_MS).toBeGreaterThanOrEqual(1500);
    expect(REPLY_AFTER_SILENCE_MS).toBeLessThanOrEqual(2500);
  });

  it('こちらから声をかける間隔は、返事の間より遥かに長い', () => {
    expect(IDLE_DEFAULTS.quietMs).toBeGreaterThan(REPLY_AFTER_SILENCE_MS * 10);
  });
});

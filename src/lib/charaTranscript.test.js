/** charaTranscript のテスト。★「窓が常に貯まっている」ことを保証する。 */
import { describe, it, expect } from 'vitest';
import {
  makeTranscript, appendFinal, markBlackout, windowText,
  charsSince, lastHeardAt, KEEP_CHARS, GAP_SEP_MS
} from './charaTranscript.js';

describe('appendFinal — 何を貯めて何を捨てるか', () => {
  it('確定した発話を時刻つきで貯める', () => {
    let s = appendFinal(makeTranscript(), { text: '港区の話でさ', tMs: 1000 });
    expect(s.items).toEqual([{ text: '港区の話でさ', tMs: 1000, source: 'room' }]);
  });

  it('★相槌だけの発話は捨てる（文脈にならない）', () => {
    let s = makeTranscript();
    for (const t of ['あー', 'えー', 'うーん', 'うん', 'はい', 'んー', 'へー', 'うんうん。', 'そう', 'なるほど']) {
      s = appendFinal(s, { text: t, tMs: 1000 });
    }
    expect(s.items).toEqual([]);
  });

  it('★同じ文が3秒以内に再度来たら重複として捨てる（Web Speech が二重に返す）', () => {
    let s = appendFinal(makeTranscript(), { text: 'ああとかね', tMs: 3000 });
    s = appendFinal(s, { text: 'ああとかね', tMs: 3500 });
    expect(s.items).toHaveLength(1);
  });

  it('同じ文でも3秒以上あいていれば別の発話として残す', () => {
    let s = appendFinal(makeTranscript(), { text: '港区の話でさ', tMs: 1000 });
    s = appendFinal(s, { text: '港区の話でさ', tMs: 9000 });
    expect(s.items).toHaveLength(2);
  });

  it('空文字と壊れた時刻は無視する', () => {
    let s = makeTranscript();
    expect(appendFinal(s, { text: '  ', tMs: 1 }).items).toEqual([]);
    expect(appendFinal(s, { text: 'あ話', tMs: NaN }).items).toEqual([]);
  });

  it('★元の state を書き換えない（純関数）', () => {
    const a = appendFinal(makeTranscript(), { text: '一つ目', tMs: 1 });
    const b = appendFinal(a, { text: '二つ目', tMs: 5000 });
    expect(a.items).toHaveLength(1);
    expect(b.items).toHaveLength(2);
  });

  it('★文字数の上限を超えたら古い方から落とす', () => {
    let s = makeTranscript();
    // ★毎回違う文にする。同じ文だと重複判定に当たって追加されない（それは別のテストで見る）
    for (let i = 0; i < 200; i += 1) {
      s = appendFinal(s, { text: `${i}番目の話`.padEnd(30, 'あ'), tMs: 1000 + i * 100 });
    }
    const total = s.items.reduce((n, it) => n + it.text.length, 0);
    expect(total).toBeLessThanOrEqual(KEEP_CHARS);
    expect(lastHeardAt(s)).toBe(1000 + 199 * 100);   // ★新しい方が残っている
  });

  it('★同じ相槌が場で何度も出ても、間があけば拾える（重複判定で黙らない）', () => {
    let s = makeTranscript();
    // 「じゃないですか」が10秒おきに5回。★実際の場で起きる
    for (let i = 0; i < 5; i += 1) s = appendFinal(s, { text: 'じゃないですか', tMs: i * 10_000 });
    expect(s.items).toHaveLength(5);
  });
});

describe('windowText — 頭脳に渡す窓', () => {
  it('★間があいたところに区切りを入れる（一続きの1文だと誤読させない）', () => {
    let s = appendFinal(makeTranscript(), { text: '港区の話でさ', tMs: 1000 });
    s = appendFinal(s, { text: 'ああとかね', tMs: 1000 + GAP_SEP_MS + 100 });
    expect(windowText(s, { nowMs: 3000 })).toBe('港区の話でさ／ああとかね');
  });

  it('間が短ければ区切らない（同じ人が続けて喋っている）', () => {
    let s = appendFinal(makeTranscript(), { text: 'いやそれは', tMs: 1000 });
    s = appendFinal(s, { text: 'さあ', tMs: 1200 });
    expect(windowText(s, { nowMs: 2000 })).toBe('いやそれはさあ');
  });

  it('★聞けていなかった区間には「…」を入れる', () => {
    let s = appendFinal(makeTranscript(), { text: '前の話', tMs: 1000 });
    s = markBlackout(s, { fromMs: 2000, toMs: 4000 });   // キャラが喋っていた
    s = appendFinal(s, { text: '後の話', tMs: 5000 });
    expect(windowText(s, { nowMs: 6000 })).toBe('前の話…後の話');
  });

  it('窓の外（古い発話）は入らない', () => {
    let s = appendFinal(makeTranscript(), { text: '大昔の話', tMs: 1000 });
    s = appendFinal(s, { text: 'いまの話', tMs: 90_000 });
    expect(windowText(s, { nowMs: 90_000, spanMs: 30_000 })).toBe('いまの話');
  });

  it('★溢れたら末尾（新しい方）を残す。要約はしない', () => {
    let s = makeTranscript();
    for (let i = 0; i < 20; i += 1) s = appendFinal(s, { text: `${i}`.repeat(20), tMs: 1000 + i * 100 });
    const full = windowText(s, { nowMs: 5000 });
    const w = windowText(s, { nowMs: 5000, maxChars: 50 });
    expect(w).toHaveLength(50);
    expect(full.endsWith(w)).toBe(true);              // ★末尾（新しい方）が残る
    expect(w.startsWith('0'.repeat(20))).toBe(false); // 一番古いものは落ちている
  });

  it('何も聞こえていなければ空', () => {
    expect(windowText(makeTranscript(), { nowMs: 1000 })).toBe('');
  });
});

describe('charsSince / lastHeardAt — 拍が使う計器', () => {
  it('指定時刻より後の文字数を数える', () => {
    let s = appendFinal(makeTranscript(), { text: 'あいう', tMs: 1000 });
    s = appendFinal(s, { text: 'かきくけこ', tMs: 5000 });
    expect(charsSince(s, 0)).toBe(8);
    expect(charsSince(s, 2000)).toBe(5);
  });

  it('最後に聞こえた時刻を返す。無ければ null', () => {
    expect(lastHeardAt(makeTranscript())).toBe(null);
    const s = appendFinal(makeTranscript(), { text: 'あ話', tMs: 4200 });
    expect(lastHeardAt(s)).toBe(4200);
  });
});

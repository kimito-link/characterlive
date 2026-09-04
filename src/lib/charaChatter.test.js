import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHATTER_LINES,
  CHATTER_MIN_GAP_MS,
  CHATTER_MAX_GAP_MS,
  CHATTER_LONELY_MS,
  pickDeterministic,
  nextChatterDelayMs,
  shouldChatter,
  resolveChatterKind,
  pickChatterSpeaker,
  buildChatterLine
} from './charaChatter.js';

const IDS = /** @type {const} */ (['rinku', 'konta', 'tanunee']);
const KINDS = /** @type {const} */ (['greet', 'idle', 'cheer', 'tease', 'silence']);

describe('台詞の中身', () => {
  it('3人 × 5種類がすべて埋まっている(黙る組み合わせが無い)', () => {
    for (const id of IDS) {
      for (const kind of KINDS) {
        const lines = CHATTER_LINES[id][kind];
        expect(Array.isArray(lines), `${id}.${kind} が配列でない`).toBe(true);
        expect(lines.length, `${id}.${kind} が空`).toBeGreaterThan(0);
        for (const l of lines) expect(String(l).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('吹き出しに収まる長さ(1行が長すぎない)', () => {
    for (const id of IDS) {
      for (const kind of KINDS) {
        for (const l of CHATTER_LINES[id][kind]) {
          // 吹き出しは3行で切れる。全角30字を超えると読めない。
          expect(l.length, `長すぎ: ${id}.${kind} "${l}"`).toBeLessThanOrEqual(34);
        }
      }
    }
  });

  it('★3人の口調が混ざっていない(4コマの描き分けを守る)', () => {
    // りんくは「のだ」。こん太/たぬ姉は使わない。
    const rinku = Object.values(CHATTER_LINES.rinku).flat();
    expect(rinku.filter((l) => l.includes('のだ')).length).toBeGreaterThan(rinku.length / 2);

    // たぬ姉は「のだ」を使わない(冷静な口調)。
    for (const l of Object.values(CHATTER_LINES.tanunee).flat()) {
      expect(l, `たぬ姉がりんく口調: "${l}"`).not.toContain('のだ');
    }
    // こん太も「のだ」を使わない。
    for (const l of Object.values(CHATTER_LINES.konta).flat()) {
      expect(l, `こん太がりんく口調: "${l}"`).not.toContain('のだ');
    }
  });
});

describe('抽選', () => {
  it('同じ seed なら常に同じ(決定論)', () => {
    expect(pickDeterministic(['a', 'b', 'c'], 'x')).toBe(pickDeterministic(['a', 'b', 'c'], 'x'));
  });

  it('空配列でも壊れない', () => {
    expect(pickDeterministic([], 'x')).toBeNull();
    expect(pickDeterministic(null, 'x')).toBeNull();
  });
});

describe('間合い', () => {
  it('待ち時間は最短〜最長の範囲に収まる', () => {
    for (let t = 0; t < 200; t += 1) {
      const d = nextChatterDelayMs(t);
      expect(d).toBeGreaterThanOrEqual(CHATTER_MIN_GAP_MS);
      expect(d).toBeLessThanOrEqual(CHATTER_MAX_GAP_MS);
    }
  });

  it('等間隔ではない(機械に見せない)', () => {
    const set = new Set();
    for (let t = 0; t < 40; t += 1) set.add(nextChatterDelayMs(t));
    expect(set.size).toBeGreaterThan(5);
  });

  // ★2026-09-04 設計変更: 「開いた瞬間に喋る」をやめた。
  //   開くのは配信の準備中であることが多く、いきなり話しかけられるのは急かしそのもの。
  //   居ることは3人が画面に浮いている時点で伝わっている(声で主張しなくてよい)。
  it('★開いた直後は喋らない(準備中に話しかけない)', () => {
    expect(shouldChatter({ nowMs: 0, lastChatterAtMs: NaN, startedAtMs: 0 })).toBe(false);
    expect(shouldChatter({ nowMs: 10_000, lastChatterAtMs: NaN, startedAtMs: 0 })).toBe(false);
  });

  it('開いてから十分経てば、こちらから一言だけ言う(0人でも独りにしない)', () => {
    expect(shouldChatter({ nowMs: 60_000, lastChatterAtMs: NaN, startedAtMs: 0 })).toBe(true);
  });

  it('間が空いていなければ喋らない', () => {
    expect(shouldChatter({ nowMs: 1000, lastChatterAtMs: 0, turn: 0 })).toBe(false);
  });

  it('十分間が空けば喋る', () => {
    expect(
      shouldChatter({ nowMs: CHATTER_MAX_GAP_MS + 1, lastChatterAtMs: 0, turn: 0 })
    ).toBe(true);
  });

  it('★人が喋った直後は黙る(かぶせて自分語りしない)', () => {
    const now = 100_000;
    expect(
      shouldChatter({
        nowMs: now,
        lastChatterAtMs: 0,
        lastExternalAtMs: now - 1000, // 1秒前に読み上げがあった
        turn: 0
      })
    ).toBe(false);
  });

  // ★人が喋った直後に譲る時間を 6秒 → 12秒 に延ばした(2026-09-04)。
  //   6秒では、続きを言いかけた相手にかぶる。Grok:「急かすのは silence 判定の短さ」
  it('人が喋った直後は、7秒経っていても黙っている', () => {
    const now = 100_000;
    expect(
      shouldChatter({ nowMs: now, lastChatterAtMs: 0, lastExternalAtMs: now - 7000, turn: 0 })
    ).toBe(false);
  });

  it('人の発言から十分経てば再び喋る', () => {
    const now = 100_000;
    expect(
      shouldChatter({ nowMs: now, lastChatterAtMs: 0, lastExternalAtMs: now - 15_000, turn: 0 })
    ).toBe(true);
  });
});

describe('何を言うか', () => {
  it('1回目は挨拶(配信の入り口)', () => {
    expect(resolveChatterKind({ nowMs: 0, turn: 0, startedAtMs: 0 })).toBe('greet');
  });

  it('★長く静かなら「いるよ」か励ましになる(4コマの芯)', () => {
    const now = CHATTER_LONELY_MS + 10_000;
    const kinds = new Set();
    for (let t = 1; t < 30; t += 1) {
      kinds.add(resolveChatterKind({ nowMs: now, turn: t, startedAtMs: 0 }));
    }
    // 静かなときは silence / cheer だけ(雑談やいじりで流さない)
    for (const k of kinds) expect(['silence', 'cheer']).toContain(k);
    expect(kinds.has('silence')).toBe(true);
  });

  it('動きがあるうちは雑談中心だが、励ましもいじりも混ざる', () => {
    const kinds = new Set();
    for (let t = 1; t < 60; t += 1) {
      kinds.add(resolveChatterKind({ nowMs: 10_000, turn: t, lastExternalAtMs: 9_000 }));
    }
    expect(kinds.has('idle')).toBe(true);
    expect(kinds.size).toBeGreaterThan(1);
  });
});

describe('誰が言うか', () => {
  it('直前に喋った子は連投しない', () => {
    for (const last of IDS) {
      for (let t = 0; t < 40; t += 1) {
        for (const kind of KINDS) {
          expect(pickChatterSpeaker({ kind, turn: t, lastSpeaker: last })).not.toBe(last);
        }
      }
    }
  });

  it('★いじりは たぬ姉の役(4コマの役割分担)', () => {
    for (let t = 0; t < 20; t += 1) {
      expect(pickChatterSpeaker({ kind: 'tease', turn: t, lastSpeaker: null })).toBe('tanunee');
    }
  });

  it('たぬ姉が直前ならいじりも他の子に回る(連投回避が優先)', () => {
    expect(pickChatterSpeaker({ kind: 'tease', turn: 1, lastSpeaker: 'tanunee' })).not.toBe(
      'tanunee'
    );
  });

  it('3人に散る(1人に偏らない)', () => {
    const seen = new Set();
    let last = null;
    for (let t = 0; t < 30; t += 1) {
      const who = pickChatterSpeaker({ kind: 'idle', turn: t, lastSpeaker: last });
      seen.add(who);
      last = who;
    }
    expect(seen.size).toBe(3);
  });
});

describe('1回ぶんの発話', () => {
  it('必ず誰かが何かを言う(空にならない)', () => {
    for (let t = 0; t < 100; t += 1) {
      const line = buildChatterLine({ nowMs: t * 1000, turn: t, startedAtMs: 0 });
      expect(IDS).toContain(line.charaId);
      expect(line.text.trim().length).toBeGreaterThan(0);
      expect(KINDS).toContain(line.kind);
    }
  });

  it('喋った子の台詞が、その子の台本から出ている(口調が混ざらない)', () => {
    for (let t = 0; t < 100; t += 1) {
      const line = buildChatterLine({ nowMs: t * 1000, turn: t, startedAtMs: 0 });
      const own = Object.values(CHATTER_LINES[line.charaId]).flat();
      expect(own, `${line.charaId} が他人の台詞を喋った: "${line.text}"`).toContain(line.text);
    }
  });

  it('同じ入力なら同じ結果(決定論)', () => {
    const a = buildChatterLine({ nowMs: 5000, turn: 3, startedAtMs: 0 });
    const b = buildChatterLine({ nowMs: 5000, turn: 3, startedAtMs: 0 });
    expect(a).toEqual(b);
  });

  it('★視聴者0のまま放っておいても喋り続ける(沈黙しない)', () => {
    // 5分間、外部入力ゼロで回す。
    let last = -Infinity;
    let turn = 0;
    let spoke = 0;
    let lastSpeaker = null;
    for (let now = 0; now <= 1_200_000; now += 500) {
      if (!shouldChatter({ nowMs: now, lastChatterAtMs: last, turn, startedAtMs: 0 })) continue;
      const line = buildChatterLine({ nowMs: now, turn, lastSpeaker, startedAtMs: 0 });
      lastSpeaker = line.charaId;
      last = now;
      turn += 1;
      spoke += 1;
    }
    // ★20分で十数回 = 1〜2分に1回。「居る」が伝わり、かつ急かさない量。
    //   ここを増やす"改善"は劣化(9〜20秒に戻すと配信のテンポを壊す)。
    expect(spoke).toBeGreaterThan(12);
    expect(spoke).toBeLessThan(30);
  });
});

/*
 * ★2026-09-04 実測で踏んだ回帰:
 *   フレーム駆動を requestAnimationFrame 一本にしたところ、
 *   **タブが非アクティブだと rAF が完全に停止**するため、
 *   浮遊も自発発話も止まっていた(実測: 40秒で1回しか喋らない・transform が固定)。
 *   配信で使う部品が「裏に回ると死ぬ」のは致命的なので、
 *   隠れている間はタイマーで進める作りを文字列で固定する。
 *   (jsdom/happy-dom では visibilityState を切り替えても rAF の実挙動までは
 *    再現できないため、実装の形を検査する = wiring テストの作法)
 */
describe('★裏に回っても止まらない(実測で踏んだ事故の固定)', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'charaLiveController.js'),
    'utf8'
  );

  /*
   * ★2026-09-04: 実装が「切り替え」から【併走】に変わった。
   *   「予約時に isHidden() で分岐」では、最初から hidden のページで
   *   rAF のコールバックが永久に発火せず、分岐の機会自体が来なかった（実測）。
   *   よって rAF とタイマーを両方仕掛け、先着を採る形に修正した。
   */
  it('rAF だけに頼らず、タイマーも必ず併走させている', () => {
    expect(src, 'visibilityState を見ていない').toContain('visibilityState');
    // ★rAF の有無に関わらず setTimeout を仕掛けていること
    //   （条件分岐の中だけに setTimeout がある形は、上記の理由で不可）。
    expect(src).toMatch(/const timerId = setTimeout\(/);
    expect(src).toMatch(/requestAnimationFrame\(once\)/);
    // 二重発火を潰すガードがあること。
    expect(src).toContain('if (fired) return;');
  });

  it('裏では間隔を粗くして CPU を食わせない', () => {
    expect(src).toContain('HIDDEN_FRAME_MS');
  });
});

/*
 * ★2026-09-04 実測で2度踏んだ事故の再現テスト（最重要）。
 *
 *   症状: LPを開くと3人が【1回喋ったきり永久に止まる】。
 *   条件: **ページが最初から hidden**（別ウィンドウが前面／OBSの非表示シーン等）。
 *   真因: 次フレームの予約が rAF のコールバック内にあるため、
 *     rAF が一度も発火しないと **予約する機会そのものが来ない**。
 *     visibilitychange も、最初から hidden なら発火しないので救えない。
 *   対策: rAF とタイマーを併走させ、先着で進める。
 *
 *   ★ここでは「rAFが一度も発火しない環境」を注入して、それでも進むことを確かめる。
 */
describe('★最初から隠れていても止まらない', () => {
  it('rAF が永久に発火しない環境でも、タイマー側でフレームが進む', async () => {
    const { startCharaLive } = await import('./charaLiveController.js');
    const { Window } = await import('happy-dom');
    const w = new Window({ url: 'http://localhost/' });
    const doc = /** @type {any} */ (w.document);

    // ★rAF は登録だけして【絶対に呼ばない】= 隠れたタブの再現。
    let rafRegistered = 0;
    /** @type {any} */ (w).requestAnimationFrame = () => { rafRegistered += 1; return 1; };
    /** @type {any} */ (w).cancelAnimationFrame = () => {};
    // 最初から hidden。
    Object.defineProperty(doc, 'visibilityState', { get: () => 'hidden', configurable: true });

    const mount = doc.createElement('div');
    doc.body.appendChild(mount);
    const live = startCharaLive({ doc, mount, resolveUrl: (p) => p });

    // ★フレームが進んだことを「浮遊の位置が変わったか」で見る(2026-09-04変更)。
    //   以前は「誰かが喋ったか」で見ていたが、開いた直後の発話をやめた(急かさないため)ので
    //   その証拠は使えなくなった。★浮遊は毎フレーム動くので、こちらの方が直接的。
    const face = doc.querySelector('.nlcl-chara');
    const before = face?.getAttribute('style') || '';

    // タイマー側が拾ってフレームが進むのを待つ。
    await new Promise((r) => setTimeout(r, 600));

    const after = face?.getAttribute('style') || '';
    expect(rafRegistered, 'rAF は登録されている（併走している証拠）').toBeGreaterThan(0);
    expect(face, 'キャラが描かれている').toBeTruthy();
    expect(after, '★rAFが来なくてもフレームが進んでいる(浮遊が動いた)').not.toBe(before);

    live.destroy();
    w.close();
  });
});

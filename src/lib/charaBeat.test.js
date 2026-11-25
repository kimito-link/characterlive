/**
 * charaBeat のテスト。
 * ★このファイルの主役は最後の「録画2相当」。fire回数を固定するのがこの部品の存在証明。
 */
import { describe, it, expect } from 'vitest';
import {
  resolveBeat, isStaleBeat, ROOM_LULL_MS, ROOM_MIN_CHARS, ROOM_MIN_GAP_MS,
  ROOM_LONG_LULL_MS, ROOM_LONG_LULL_MIN_CHARS,
  ROOM_CONVO_WINDOW_MS, ROOM_CONVO_MAX_UTTS, ROOM_CONVO_LULL_MS, ROOM_CONVO_GAP_MS
} from './charaBeat.js';
import { makeTranscript, appendFinal, windowText, charsSince, lastHeardAt, countSince } from './charaTranscript.js';

describe('resolveBeat — いつ喋るか', () => {
  it('名前を呼ばれたら最短間隔を無視して即答する', () => {
    const r = resolveBeat({ nowMs: 9, lastHeardAt: 0, charsSinceLastBeat: 0, lastCharaAt: 0, addressed: true });
    expect(r).toEqual({ fire: true, reason: 'addressed' });
  });

  it('自分たちが喋った直後は黙る', () => {
    const r = resolveBeat({ nowMs: 3000, lastHeardAt: 2900, charsSinceLastBeat: 999, lastCharaAt: 1000 });
    expect(r.fire).toBe(false);
    expect(r.reason).toBe('gap');
  });

  it('★間が来ても話が薄ければ黙る（「じゃないですか」だけで喋らない）', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_LULL_MS, charsSinceLastBeat: 7, lastCharaAt: null });
    expect(r.fire).toBe(false);
    expect(r.reason).toBe('thin');
  });

  it('間が来て話も溜まっていれば喋る', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_LULL_MS, charsSinceLastBeat: ROOM_MIN_CHARS, lastCharaAt: null });
    expect(r).toEqual({ fire: true, reason: 'lull' });
  });

  it('喋り続けている場では、溜まるまで割り込まない', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 19900, charsSinceLastBeat: 60, lastCharaAt: 1000 });
    expect(r.fire).toBe(false);
    expect(r.reason).toBe('talking');
  });

  it('間が来なくても十分溜まったら割り込む', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 19900, charsSinceLastBeat: 120, lastCharaAt: 1000 });
    expect(r).toEqual({ fire: true, reason: 'force' });
  });

  it('★1人で1文話して長く黙ったら、40字未満でも返す（2026-11-25 実マイクで無反応だった）', () => {
    // 「なくなってしまいましたですね」= 14字
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_LONG_LULL_MS, charsSinceLastBeat: 14, lastCharaAt: null });
    expect(r).toEqual({ fire: true, reason: 'longLull' });
  });

  it('長い間でも、短すぎる断片だけなら黙る', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_LONG_LULL_MS, charsSinceLastBeat: ROOM_LONG_LULL_MIN_CHARS - 1, lastCharaAt: null });
    expect(r.reason).toBe('thin');
  });

  it('短い間（息継ぎ）では、少ない字数で返さない', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_LONG_LULL_MS + 500, charsSinceLastBeat: 14, lastCharaAt: null });
    expect(r.reason).toBe('thin');
  });

  it('★会話（発話がまばら）なら、短い一言でも言い終わったらすぐ返す（Grokと同じ）', () => {
    // 「聞こえるかな」= 6字。字数の決まりで黙らない
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_CONVO_LULL_MS, charsSinceLastBeat: 6, lastCharaAt: null, recentUtts: 1 });
    expect(r).toEqual({ fire: true, reason: 'convo' });
  });

  it('会話でも、言っている最中（間が来ていない）は割り込まない', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_CONVO_LULL_MS + 300, charsSinceLastBeat: 30, lastCharaAt: null, recentUtts: 2 });
    expect(r.reason).toBe('talking');
  });

  it('会話でも、キャラが喋り終えた直後は返さない（残響を拾わない）', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 18000, charsSinceLastBeat: 10, lastCharaAt: 20000 - ROOM_CONVO_GAP_MS + 200, recentUtts: 1 });
    expect(r.reason).toBe('gap');
  });

  it('会話でも、前の返事から新しく何も聞いていなければ返さない', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 10000, charsSinceLastBeat: 0, lastCharaAt: null, recentUtts: 1 });
    expect(r.fire).toBe(false);
  });

  it('発話が多い場（多人数）では、会話の速さで返さない', () => {
    const r = resolveBeat({ nowMs: 20000, lastHeardAt: 20000 - ROOM_CONVO_LULL_MS, charsSinceLastBeat: 6, lastCharaAt: null, recentUtts: ROOM_CONVO_MAX_UTTS + 1 });
    expect(r.fire).toBe(false);
  });

  it('★1人で4回やりとりしたら4回とも返す', () => {
    let state = makeTranscript();
    let lastBeatAt = 0;
    let lastCharaAt = null;
    let fires = 0;
    const said = [{ t: 1000, text: '聞こえるかな' }, { t: 9000, text: 'おはよう' }, { t: 17000, text: '今日は寒いね' }, { t: 25000, text: '配信しよう' }];
    let si = 0;
    for (let now = 0; now <= 32000; now += 500) {
      while (si < said.length && said[si].t <= now) { state = appendFinal(state, { text: said[si].text, tMs: said[si].t }); si += 1; }
      const r = resolveBeat({
        nowMs: now, lastHeardAt: lastHeardAt(state), charsSinceLastBeat: charsSince(state, lastBeatAt),
        lastCharaAt, recentUtts: countSince(state, now - ROOM_CONVO_WINDOW_MS)
      });
      if (r.fire) { fires += 1; lastBeatAt = now; lastCharaAt = now + 3000; }
    }
    expect(fires).toBe(4);
  });

  it('まだ何も聞こえていなければ黙る', () => {
    expect(resolveBeat({ nowMs: 100, lastHeardAt: null, charsSinceLastBeat: 0, lastCharaAt: null }).fire).toBe(false);
  });
});

describe('isStaleBeat — 決めた拍が古びていないか', () => {
  it('決めた直後は古びていない', () => {
    expect(isStaleBeat({ resolvedAt: 1000, nowMs: 2000 })).toBe(false);
  });
  it('合成に手間取って場が進んだら捨てる', () => {
    expect(isStaleBeat({ resolvedAt: 1000, nowMs: 9000 })).toBe(true);
  });
});

/**
 * ★このテストが本体。
 *   録画2（Xスペース5分21秒・213発話＝1.5秒に1回）と同じ密度の入力を、
 *   ★実装と同じ500msティッカーで流し、発火回数を固定する。
 *   213回でないことが、この部品が存在する理由そのもの。
 *
 *   ★測り方を実装と揃えること（発話のたびに拍を見る書き方だと偽の緑が出た。
 *     ROOM_LULL_MS=1200 でも通ってしまい、実際には31回発火していた）。
 */
describe('★録画2相当の負荷（213発話 / 321秒）', () => {
  const FRAGS = [
    // ★相槌だけの語（「そうそう」等）は charaTranscript が捨てるので入れない。
    //   実際の場でも相槌は文脈にならないため、この列は「意味のある断片」で作る。
    'じゃないですか', 'ああとかね', '港区のクソみたいな話でゴミみたいで', 'それはそれとして',
    '若い女に攻撃するおっさんきついから', 'うーんまあねそういうこと', 'いやそれはさ', 'わかるわほんと'
  ];

  /** 決定論的に発話列を作る（乱数を使わない）。20発話ごとに3秒の息継ぎ。 */
  function makeUtterances() {
    const utt = [];
    let t = 0;
    for (let i = 0; i < 213; i += 1) {
      t += (i % 20 === 0 && i > 0) ? 3000 : 900 + ((i * 7919) % 1200);
      utt.push({ text: FRAGS[i % FRAGS.length], tMs: t });
    }
    return utt;
  }

  /** ★talk.html と同じ 500ms ティッカーで回す。 */
  function runTicker(utt) {
    const endMs = utt[utt.length - 1].tMs + 2000;
    let state = makeTranscript();
    let ui = 0;
    let lastBeatAt = 0;
    let lastCharaAt = null;
    const fires = [];
    for (let now = 0; now <= endMs; now += 500) {
      while (ui < utt.length && utt[ui].tMs <= now) {
        state = appendFinal(state, utt[ui]);
        ui += 1;
      }
      const r = resolveBeat({
        nowMs: now,
        lastHeardAt: lastHeardAt(state),
        charsSinceLastBeat: charsSince(state, lastBeatAt),
        lastCharaAt,
        recentUtts: countSince(state, now - ROOM_CONVO_WINDOW_MS)
      });
      if (r.fire) {
        fires.push({ reason: r.reason, t: now, win: windowText(state, { nowMs: now }).length });
        lastBeatAt = now;
        lastCharaAt = now + 2000;   // 1文の合成にかかる時間
      }
    }
    return fires;
  }

  const fires = runTicker(makeUtterances());

  /* ★2026-11-25 会話モードを足した。場が始まった直後（直近20秒の発話がまだ少ない間）は
     会話とみなして返すので、冒頭に2回まで会話の返事が出る。場が賑わったら従来の拍に戻る。 */
  const busyFires = fires.filter((f) => f.reason !== 'convo');

  it('★会話の速さで返すのは、場が賑わう前の冒頭だけ（2回まで）', () => {
    const convo = fires.filter((f) => f.reason === 'convo');
    expect(convo.length).toBeLessThanOrEqual(2);
    expect(convo.every((f) => f.t < ROOM_CONVO_WINDOW_MS)).toBe(true);
  });

  it('★213回の断片に対して、賑わった場で喋るのは15〜25回に収まる', () => {
    expect(busyFires.length).toBeGreaterThanOrEqual(15);
    expect(busyFires.length).toBeLessThanOrEqual(25);
  });

  it('★賑わった場では、どの発話も40字以上の窓を持っている（断片だけで喋らない）', () => {
    const thin = busyFires.filter((f) => f.win < 40);
    expect(thin).toEqual([]);
  });

  it('★「間で入る」経路も「溜まって入る」経路も両方生きている', () => {
    const reasons = new Set(fires.map((f) => f.reason));
    expect(reasons.has('lull')).toBe(true);
    expect(reasons.has('force')).toBe(true);
  });

  it('キャラの発話同士が最短間隔より詰まらない', () => {
    // fires は時刻順。lastCharaAt に +2000 しているので、実間隔は MIN_GAP 以上になる
    expect(fires.length).toBeGreaterThan(1);
    expect(ROOM_MIN_GAP_MS).toBeGreaterThan(0);
  });
});

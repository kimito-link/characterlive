/**
 * charaBeat のテスト。
 * ★このファイルの主役は最後の「録画2相当」。fire回数を固定するのがこの部品の存在証明。
 */
import { describe, it, expect } from 'vitest';
import { resolveBeat, isStaleBeat, ROOM_LULL_MS, ROOM_MIN_CHARS, ROOM_MIN_GAP_MS } from './charaBeat.js';
import { makeTranscript, appendFinal, windowText, charsSince, lastHeardAt } from './charaTranscript.js';

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
        lastCharaAt
      });
      if (r.fire) {
        fires.push({ reason: r.reason, win: windowText(state, { nowMs: now }).length });
        lastBeatAt = now;
        lastCharaAt = now + 2000;   // 1文の合成にかかる時間
      }
    }
    return fires;
  }

  const fires = runTicker(makeUtterances());

  it('★213回の断片に対して、喋るのは15〜25回に収まる', () => {
    expect(fires.length).toBeGreaterThanOrEqual(15);
    expect(fires.length).toBeLessThanOrEqual(25);
  });

  it('★どの発話も40字以上の窓を持っている（断片だけで喋らない）', () => {
    const thin = fires.filter((f) => f.win < 40);
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

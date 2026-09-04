/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';
import { startCharaLive, REACTION_MIN_GAP_MS } from './charaLiveController.js';
import {
  listCharaLiveImagePaths,
  buildCharaLiveStageDom,
  charaLiveStageCss
} from './charaLiveStage.js';
import { CHARA_LIVE_IDS } from './charaLiveState.js';

/** 時間と rAF を手で回すテスト用ハーネス(実時間に依存させない)。 */
/**
 * @param {{ chatter?: boolean }} [opts]
 *   chatter=false で自発発話を止める。
 *   ★相槌/返事など「外からの入力」だけを見たいテストは必ず false にする
 *     (自発発話が同時に走ると、喋っている子が2人になって数が合わなくなる)。
 */
function makeHarness(opts = {}) {
  let now = 0;
  /** @type {Array<() => void>} */
  let frames = [];
  const live = startCharaLive({
    doc: document,
    resolveUrl: (p) => `chrome-extension://test/${p}`,
    now: () => now,
    requestFrame: (cb) => {
      frames.push(() => cb(now));
      return frames.length;
    },
    cancelFrame: () => {},
    reducedMotion: false,
    getHeatLevel: () => 0.3,
    chatter: opts.chatter === true
  });
  return {
    live,
    advance(ms) {
      now += ms;
      const due = frames;
      frames = [];
      for (const f of due) f();
    },
    at: () => now
  };
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
});

describe('常駐ステージ', () => {
  it('3 体ぶんの DOM が常に出る', () => {
    const { root } = buildCharaLiveStageDom(document, (p) => p);
    const chars = root.querySelectorAll('.nlcl-chara');
    expect(chars).toHaveLength(3);
    expect([...chars].map((c) => c.dataset.chara)).toEqual(CHARA_LIVE_IDS);
  });

  it('配信の操作を奪わない(pointer-events を切ってある)', () => {
    const { live } = makeHarness();
    expect(live.root.className).toBe('nlcl-stage');
    const css = document.getElementById('nlcl-stage-style').textContent;
    expect(css).toContain('pointer-events: none');
    live.destroy();
  });

  it('★先読みは21枚だけで全組み合わせを賄える(パーツ方式の効き目)', () => {
    const paths = listCharaLiveImagePaths();
    // 3キャラ x (顔1 + 目4 + 口2) = 21。表情を足しても枚数は増えない。
    expect(paths.length).toBe(21);
    expect(new Set(paths).size).toBe(21);
    for (const p of paths) {
      expect(p.endsWith('.png')).toBe(true);
      expect(p.startsWith('assets/characters/')).toBe(true);
    }
  });

  it('setVisible(false) で隠れ、描画も止まる(閉じても CPU を食わない)', () => {
    const h = makeHarness();
    h.advance(0);
    const el = h.live.root.querySelector('.nlcl-chara');
    h.advance(500);
    const before = el.style.transform;

    h.live.setVisible(false);
    expect(h.live.root.hidden).toBe(true);
    // 非表示中はフレームが進んでも描き変わらない。
    h.advance(5000);
    expect(el.style.transform).toBe(before);

    // 戻せば再び動き出す。
    h.live.setVisible(true);
    expect(h.live.root.hidden).toBe(false);
    h.advance(1500);
    expect(el.style.transform).not.toBe(before);
    h.live.destroy();
  });

  it('destroy でレイヤーが消える(放送ページに残骸を残さない)', () => {
    const { live } = makeHarness();
    expect(document.querySelectorAll('.nlcl-stage')).toHaveLength(1);
    live.destroy();
    expect(document.querySelectorAll('.nlcl-stage')).toHaveLength(0);
  });
});

describe('常駐アニメーション', () => {
  it('時間が進むと立ち絵の位置が変わる(止まって見えない)', () => {
    const h = makeHarness();
    h.advance(0);
    const first = h.live.root.querySelector('.nlcl-chara').style.transform;
    h.advance(1500);
    const later = h.live.root.querySelector('.nlcl-chara').style.transform;
    expect(first).toBeTruthy();
    expect(later).not.toBe(first);
    h.live.destroy();
  });
});

describe('コメント読み上げへの相槌', () => {
  it('読み上げが鳴った瞬間に 1 体が相槌を入れる', () => {
    const h = makeHarness();
    h.advance(0);
    h.live.onCommentSpoken({ commentKey: 'no:1' });
    h.advance(50);
    const speaking = h.live.root.querySelectorAll('.nlcl-chara.is-speaking');
    expect(speaking).toHaveLength(1);
    // 吹き出しが出ている。
    const bubble = speaking[0].querySelector('.nlcl-chara__bubble');
    expect(bubble.hidden).toBe(false);
    expect(bubble.textContent).toBeTruthy();
    h.live.destroy();
  });

  it('読み上げが終わったら黙る(声が止まったのに口が動き続けない)', () => {
    const h = makeHarness();
    h.advance(0);
    h.live.onCommentSpoken({ commentKey: 'no:1' });
    h.advance(50);
    expect(h.live.root.querySelectorAll('.nlcl-chara.is-speaking')).toHaveLength(1);
    h.live.onCommentSpokenEnd();
    h.advance(50);
    expect(h.live.root.querySelectorAll('.nlcl-chara.is-speaking')).toHaveLength(0);
    h.live.destroy();
  });

  it('連続コメントで喋りっぱなしにならない(間引きが効く)', () => {
    const h = makeHarness();
    h.advance(0);
    // 立て続けに 10 件届いても、間引き間隔より短ければ 1 回しか反応しない。
    for (let i = 0; i < 10; i += 1) {
      h.live.onCommentSpoken({ commentKey: `no:${i}` });
      h.advance(20);
    }
    expect(h.live.root.querySelectorAll('.nlcl-chara.is-speaking').length).toBeLessThanOrEqual(1);
    h.live.destroy();
  });

  it('十分に間が空けば再び反応する', () => {
    const h = makeHarness();
    h.advance(0);
    h.live.onCommentSpoken({ commentKey: 'no:1' });
    h.advance(50);
    h.live.onCommentSpokenEnd();
    h.advance(REACTION_MIN_GAP_MS + 100);
    h.live.onCommentSpoken({ commentKey: 'no:2' });
    h.advance(50);
    expect(h.live.root.querySelectorAll('.nlcl-chara.is-speaking')).toHaveLength(1);
    h.live.destroy();
  });
});

describe('配信者の呼びかけへの返事', () => {
  it('名指しされた子が答える', () => {
    const h = makeHarness();
    h.advance(0);
    const who = h.live.onStreamerAddressed({
      prompt: 'たぬ姉さん、これ詳しいよね',
      answer: 'そうタヌ'
    });
    expect(who).toBe('tanunee');
    h.advance(50);
    const el = h.live.root.querySelector('[data-chara="tanunee"]');
    expect(el.classList.contains('is-speaking')).toBe(true);
    expect(el.querySelector('.nlcl-chara__bubble').textContent).toContain('そうタヌ');
    h.live.destroy();
  });

  it('返事の吹き出しには名前が付く(誰が答えたか分かる)', () => {
    const h = makeHarness();
    h.advance(0);
    h.live.onStreamerAddressed({ prompt: 'りんく、どう?', answer: 'たのしい！' });
    h.advance(50);
    const el = h.live.root.querySelector('[data-chara="rinku"]');
    expect(el.querySelector('.nlcl-chara__name').textContent).toBe('りんく');
    h.live.destroy();
  });
});

describe('AI シンキング', () => {
  it('考えている間だけ「…」が出る', () => {
    const h = makeHarness();
    h.advance(0);
    expect(h.live.root.querySelectorAll('.nlcl-chara__think:not([hidden])')).toHaveLength(0);

    const who = h.live.beginThinking({ prompt: 'こん太、これ何?' });
    expect(who).toBe('konta');
    h.advance(50);
    const thinking = h.live.root.querySelectorAll('.nlcl-chara__think:not([hidden])');
    expect(thinking).toHaveLength(1);

    h.live.endThinking();
    h.advance(50);
    expect(h.live.root.querySelectorAll('.nlcl-chara__think:not([hidden])')).toHaveLength(0);
    h.live.destroy();
  });

  it('思考は時間で勝手に消えない(AI が終わるまで続く)', () => {
    const h = makeHarness();
    h.advance(0);
    h.live.beginThinking({});
    h.advance(120000); // 2 分待っても
    expect(h.live.root.querySelectorAll('.nlcl-chara__think:not([hidden])')).toHaveLength(1);
    h.live.endThinking();
    h.advance(50);
    expect(h.live.root.querySelectorAll('.nlcl-chara__think:not([hidden])')).toHaveLength(0);
    h.live.destroy();
  });

  it('名指し無しならたぬ姉(解説役)が考える', () => {
    const h = makeHarness();
    h.advance(0);
    expect(h.live.beginThinking({})).toBe('tanunee');
    h.live.destroy();
  });
});

/**
 * CSS のブロックコメントを除いた「実際に効く宣言だけ」を返す。
 *
 * ★これが無いと事故る(2026-08-25 実際に踏んだ): 解説コメントに書いた
 *   「z-index:2147483000」を正規表現が拾い、z6 に戻してもテストが通ってしまった。
 *   テストは【実際に効く値】だけを見なければ、守っているつもりで何も守れない。
 *
 * @param {string} css
 * @returns {string}
 */
function stripCssComments(css) {
  return String(css).replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * `.nlcl-stage { … }` の中の実宣言を取り出す。
 * @param {string} css
 * @returns {string}
 */
function charaStageBlock(css) {
  const bare = stripCssComments(css);
  const i = bare.indexOf('.nlcl-stage {');
  return bare.slice(i, bare.indexOf('}', i));
}

/*
 * ★移植元(追憶のきらめき)で実機で踏んだ事故の固定。
 *
 * 追憶では会場ページに寄生していたため、mount 先と z-index を実測で決める必要があった
 * (body 直下 + 巨大 z-index にしたら、同値 z-index の全画面要素に完全に覆われて
 *  【一度も画面に出なかった】)。このリポは単体で動くので同じ z 競合は起きないが、
 * 【他ページに寄生させたときに同じ穴に落ちない】ための性質だけをここで固定する。
 */
describe('★寄生先で消えないための性質(移植元の事故から)', () => {
  /*
   * ★hidden が display:flex に負ける穴を【実際に描かせて】塞ぐ。
   *
   *   2026-09-04 にこのリポの実機(ブラウザ)で踏んだ:
   *     移植元は .nlcl-stage にだけ打ち消しを書いていたが、
   *     .nlcl-chara__think も display:flex なので同じ穴に落ち、
   *     誰も考えていないのに「…」が3体とも出っぱなしになった。
   *   ★CSS 文字列を grep するだけの検査ではこれを見逃す(移植元の検査がまさにそれ)。
   *     computed style を読む = 実際に隠れているかを見る。
   */
  const computedDisplay = (el) => el.ownerDocument.defaultView.getComputedStyle(el).display;

  it('hidden を立てた要素は実際に display:none になる(flex に負けない)', () => {
    const { live } = makeHarness();
    const chara = live.root.querySelector('.nlcl-chara');
    const think = chara.querySelector('.nlcl-chara__think');
    const bubble = chara.querySelector('.nlcl-chara__bubble');

    // 起動直後は誰も考えていない・喋っていない = 両方 hidden で、実際に消えている。
    expect(think.hidden).toBe(true);
    expect(computedDisplay(think)).toBe('none');
    expect(bubble.hidden).toBe(true);
    expect(computedDisplay(bubble)).toBe('none');

    live.setVisible(false);
    expect(computedDisplay(live.root)).toBe('none');
    live.destroy();
  });

  it('打ち消しを外すと本当に赤が出る(この計器が緑を出しっぱなしでないことの確認)', () => {
    // ★「常に緑」の検査は無いのと同じ。打ち消しを抜いた CSS を実際に当てて、
    //   hidden が効かなくなる(display:flex のまま)ことを見る。
    const doc = document;
    const broken = doc.createElement('style');
    broken.textContent = stripCssComments(charaLiveStageCss()).replace(
      /\.nlcl-stage\[hidden\],\s*\.nlcl-chara__think\[hidden\],\s*\.nlcl-chara__bubble\[hidden\] \{ display: none; \}/,
      ''
    );
    // 置換が本当に効いたことを先に確認する(効いていなければこのテストは無意味)。
    expect(broken.textContent).not.toContain('[hidden] { display: none; }');

    const host = doc.createElement('div');
    const think = doc.createElement('div');
    think.className = 'nlcl-chara__think';
    think.hidden = true;
    host.appendChild(think);
    doc.body.append(broken, host);

    // 打ち消しが無いと hidden は display:flex に負ける = これが元のバグ。
    expect(computedDisplay(think)).toBe('flex');

    broken.remove();
    host.remove();
  });

  it('親の外へ飛び出さない(fixed は mount 先を無視してしまう)', () => {
    const block = charaStageBlock(charaLiveStageCss());
    // fixed だと mount した親の中に収まらず、寄生先のレイアウトを踏み抜く。
    expect(block).not.toContain('position: fixed');
    expect(block).toContain('position: relative');
  });

  it('下の操作を奪わない(pointer-events を切ってある)', () => {
    expect(charaStageBlock(charaLiveStageCss())).toContain('pointer-events: none');
  });
});

describe('★重ね絵(パーツ方式)が DOM に出ている', () => {
  it('1体につき土台/目/口の3枚が同じ器に入る', () => {
    const { live } = makeHarness();
    for (const id of CHARA_LIVE_IDS) {
      const chara = live.root.querySelector(`.nlcl-chara[data-chara="${id}"]`);
      const layers = chara.querySelectorAll('.nlcl-chara__stack .nlcl-chara__layer');
      expect(layers.length).toBe(3);
      expect([...layers].map((l) => l.dataset.part)).toEqual(['face', 'eyes', 'mouth']);
    }
    live.destroy();
  });

  it('目/口は SR から隠す(名前を3回読ませない)', () => {
    const { live } = makeHarness();
    const chara = live.root.querySelector('.nlcl-chara');
    expect(chara.querySelector('[data-part="face"]').getAttribute('alt')).toBeTruthy();
    expect(chara.querySelector('[data-part="eyes"]').getAttribute('aria-hidden')).toBe('true');
    expect(chara.querySelector('[data-part="mouth"]').getAttribute('aria-hidden')).toBe('true');
    live.destroy();
  });

  it('★transform は1本にまとめて書く(別々に当てると上書き事故になる)', () => {
    const h = makeHarness();
    h.advance(0);
    h.advance(500);
    const el = h.live.root.querySelector('.nlcl-chara');
    const t = el.style.transform;
    // translate/rotate/scale が1つの transform 値に同居していること。
    expect(t).toMatch(/translate\(.+\) rotate\(.+\) scale\(.+\)/);
    h.live.destroy();
  });
});

/*
 * ★このリポの主目的そのもの(2026-09-04)。
 *   参照4コマ【視聴者0なのに、なんでこんなにうるさいのだ】=
 *   外から入力が1件も無くても、3人が勝手に喋り続けること。
 *   ここが通らなければ、この部品は「置物」であって目的を果たしていない。
 */
describe('★自発発話(視聴者0でも沈黙しない)', () => {
  it('コメントも呼びかけも無いのに、開いてすぐ誰かが喋る', () => {
    const h = makeHarness({ chatter: true });
    h.advance(0);
    const bubbles = [...h.live.root.querySelectorAll('.nlcl-chara__bubble')].filter(
      (b) => !b.hidden
    );
    expect(bubbles.length).toBe(1);
    expect(bubbles[0].textContent.trim().length).toBeGreaterThan(0);
    h.live.destroy();
  });

  it('放っておくと何度も喋る(1回で黙らない)', () => {
    const h = makeHarness({ chatter: true });
    const said = new Set();
    for (let i = 0; i < 400; i += 1) {
      h.advance(500); // 合計200秒
      for (const b of h.live.root.querySelectorAll('.nlcl-chara__bubble')) {
        if (!b.hidden && b.textContent.trim()) said.add(b.textContent.trim());
      }
    }
    // 200秒でいくつも違う台詞が出ている = 場が途切れていない。
    expect(said.size).toBeGreaterThan(4);
    h.live.destroy();
  });

  it('3人とも喋る(1人だけが独り言を言い続けない)', () => {
    const h = makeHarness({ chatter: true });
    const speakers = new Set();
    for (let i = 0; i < 400; i += 1) {
      h.advance(500);
      for (const el of h.live.root.querySelectorAll('.nlcl-chara')) {
        const b = el.querySelector('.nlcl-chara__bubble');
        if (b && !b.hidden && b.textContent.trim()) speakers.add(el.dataset.chara);
      }
    }
    expect(speakers.size).toBe(3);
    h.live.destroy();
  });

  it('setChatter(false) で黙る(切れる)', () => {
    const h = makeHarness({ chatter: true });
    h.advance(0);
    h.live.setChatter(false);
    // 十分な時間を進めても、新しい発話は始まらない。
    for (let i = 0; i < 120; i += 1) h.advance(500);
    const visible = [...h.live.root.querySelectorAll('.nlcl-chara__bubble')].filter(
      (b) => !b.hidden
    );
    expect(visible.length).toBe(0);
    h.live.destroy();
  });

  it('★人が喋った直後は【新しい】自発発話を始めない(かぶせない)', () => {
    // ★注意: 1回目の自発発話の吹き出しは CHATTER_HOLD_MS(4.2秒)残る。
    //   それは「かぶせ」ではないので、消えるまで待ってから観測する。
    const h = makeHarness({ chatter: true });
    h.advance(0);
    // 1回目が自然に消えるまで進める。
    for (let i = 0; i < 12; i += 1) h.advance(500); // t=6000
    const beforeTexts = new Set(
      [...h.live.root.querySelectorAll('.nlcl-chara__bubble')]
        .filter((b) => !b.hidden)
        .map((b) => b.textContent.trim())
    );

    // ここで人(コメント)が喋る → 直後の数秒は自発発話を譲るはず。
    h.live.onCommentSpoken({ commentKey: 'no:1' });
    h.advance(100);
    h.live.onCommentSpokenEnd();
    h.advance(100);

    // 相槌が畳まれた直後〜数秒は、新しい自発発話が始まっていない。
    const afterTexts = new Set(
      [...h.live.root.querySelectorAll('.nlcl-chara__bubble')]
        .filter((b) => !b.hidden)
        .map((b) => b.textContent.trim())
    );
    for (const t of afterTexts) {
      expect(beforeTexts.has(t), `人の発言直後に新しく喋り出した: "${t}"`).toBe(true);
    }
    h.live.destroy();
  });
});

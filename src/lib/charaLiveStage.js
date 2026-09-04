/**
 * charaLiveStage.js
 *
 * 「キャラライブ」の描画層。charaLiveState.js が決めた状態を DOM に落とすだけ。
 *   判断(誰が喋るか/どの表情か/どこに浮かぶか)は **一切ここに書かない**。
 *   ここが薄いほど、3 年後に見た目を変えるのが安全になる。
 *
 * 構造:
 *   .nlcl-stage                  常駐レイヤー(pointer-events:none=下の操作を邪魔しない)
 *     .nlcl-chara[data-chara]    1 体ぶん
 *       .nlcl-chara__stack       ★重ね絵(土台/目/口の3枚を同じ位置に敷く)
 *         .nlcl-chara__layer     face / eyes / mouth
 *       .nlcl-chara__bubble      吹き出し(相槌/返事の時だけ出る)
 *       .nlcl-chara__think       シンキングの「…」(AI 思考中だけ出る)
 *
 * ★移植元(追憶のきらめき)との差:
 *   移植元は「合成済み1枚の img」を src 差し替えしていた。ここは【3枚重ね】。
 *   目と口が独立して動くので、口パク中でもまばたきできる(charaParts.js 参照)。
 *   合成済み時代にあった .thumb128 への差し替え表(実在しない組み合わせを
 *   近い絵へ倒す対応表)は、パーツ方式では【組み合わせ欠けが存在しない】ので不要。
 *
 * 設計上の約束:
 *   - パーツは先読みして持っておく。src を都度差し替えると初回だけ一瞬消える。
 *   - transform は 1 本にまとめて書く(translate/rotate/scale を別々に当てると上書き事故になる)。
 *   - prefers-reduced-motion を尊重する。
 */

import { CHARA_LIVE_MEMBERS } from './charaLiveState.js';
import { charaPartPaths, listCharaPartPaths } from './charaParts.js';

/** 立ち絵の一辺(px)。下の画面の邪魔をしない大きさ。 */
export const CHARA_LIVE_SIZE_PX = 160;

/**
 * 先読みすべき画像パスの一覧。
 *
 * ★パーツ方式なので 3キャラ×7枚=21枚で全組み合わせを賄える。
 *   表情を足しても先読み枚数は増えない。
 *
 * @returns {string[]} ルート相対パス(重複なし)
 */
export function listCharaLiveImagePaths() {
  return listCharaPartPaths();
}

/**
 * 常駐レイヤーの CSS。
 *
 * @returns {string}
 */
export function charaLiveStageCss() {
  return `
.nlcl-stage {
  /*
   * ★mount 先に注意(移植元 2026-08-25 の実害):
   *   追憶では body 直下に fixed + 巨大 z-index で置いたところ、同じ z-index の
   *   全画面要素が【後から DOM に入る】ために完全に覆われ、一度も見えなかった。
   *   同値 z-index は DOM 順で後勝ちになる。
   *   ★「最大値を名乗る」でも「既存に合わせる」でもなく【実測して1つ上】が正解。
   *   このリポ単体(demo.html)では競合が無いので相対配置で足りる。
   *   他ページへ寄生させるときは mount 先の実測 z-index を見て決めること。
   */
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 24px;
  /* 下の操作を絶対に奪わない。吹き出しも含めて素通し。 */
  pointer-events: none;
  /* 親の文字設定に引きずられない(他ページに寄生する前提)。 */
  font: 13px/1.5 system-ui, "Segoe UI", "Hiragino Kaku Gothic ProN", sans-serif;
}
.nlcl-chara {
  position: relative;
  width: ${CHARA_LIVE_SIZE_PX}px;
  height: ${CHARA_LIVE_SIZE_PX}px;
  /* transform の原点を足元に。浮遊しても「立っている」感じが崩れない。 */
  transform-origin: 50% 90%;
  will-change: transform;
}
/* ★重ね絵の器。3枚を同じ矩形に敷く。 */
.nlcl-chara__stack {
  position: absolute;
  inset: 0;
  /* 立ち絵を背景から浮かせる(映像の上でも輪郭が見える)。
     ★影は stack にだけ掛ける。3枚それぞれに掛けると輪郭が三重になる。 */
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.45));
}
/*
 * ★パーツは全部 1500x1500 で「同じ位置でぴったり重なる」仕様(kimito-link の自社仕様)。
 *   だから inset:0 で同じ矩形に敷くだけで合う。座標合わせは要らない。
 */
.nlcl-chara__layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  -webkit-user-select: none;
  user-select: none;
}
/* 喋っている子を少し前に出す(誰が喋ったか一目で分かる)。 */
.nlcl-chara.is-speaking { z-index: 2; }
.nlcl-chara.is-speaking .nlcl-chara__stack {
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.5));
}
.nlcl-chara__bubble {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  max-width: 190px;
  width: max-content;
  padding: 6px 10px;
  border-radius: 12px;
  background: #fffdf7;
  color: #23303f;
  border: 2px solid #2f3a46;
  box-shadow: 2px 2px 0 rgba(47, 58, 70, 0.9);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
  /* 長文でも画面を覆わない。3 行で切る。 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  animation: nlcl-pop 160ms ease-out;
}
/* 吹き出しのしっぽ。 */
.nlcl-chara__bubble::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  margin-left: -6px;
  border: 6px solid transparent;
  border-top-color: #2f3a46;
}
.nlcl-chara__name {
  display: block;
  font-size: 10px;
  font-weight: 700;
  opacity: 0.7;
  margin-bottom: 1px;
}
/* シンキングの「…」。考えている間だけ出る。 */
.nlcl-chara__think {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  transform: translateX(-50%);
  display: flex;
  gap: 4px;
  padding: 7px 11px;
  border-radius: 999px;
  background: #fffdf7;
  border: 2px solid #2f3a46;
  box-shadow: 2px 2px 0 rgba(47, 58, 70, 0.9);
}
.nlcl-chara__think i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4b5b6b;
  animation: nlcl-think 1.25s ease-in-out infinite;
}
.nlcl-chara__think i:nth-child(2) { animation-delay: 0.18s; }
.nlcl-chara__think i:nth-child(3) { animation-delay: 0.36s; }
/* ★hidden を必ず効かせる(移植元 2026-08-25 発見のバグ):
   display:flex は hidden 属性の既定 display:none に勝ってしまうため、
   hidden を立てても隠れない。明示的に打ち消す。消さないこと。

   ★2026-09-04・このリポで実機で踏んだ2件目:
     移植元は .nlcl-stage にだけ打ち消しを書いていた。しかし
     .nlcl-chara__think も display:flex なので【同じ穴に落ちる】。
     結果、誰も考えていないのに「…」が3体とも出っぱなしになった。
     ★display:flex を持つ要素すべてに打ち消しが要る(1箇所直して安心しない)。 */
.nlcl-stage[hidden],
.nlcl-chara__think[hidden],
.nlcl-chara__bubble[hidden] { display: none; }
@keyframes nlcl-pop {
  from { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.94); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0)   scale(1); }
}
@keyframes nlcl-think {
  0%, 100% { opacity: 0.28; transform: translateY(0); }
  50%      { opacity: 1;    transform: translateY(-3px); }
}
@media (prefers-reduced-motion: reduce) {
  .nlcl-chara__bubble { animation: none; }
  .nlcl-chara__think i { animation: none; opacity: 0.7; }
}
`.trim();
}

/**
 * 常駐レイヤーの DOM を作る(まだ動かさない)。
 *
 * @param {Document} doc
 * @param {(path: string) => string} resolveUrl chrome.runtime.getURL 相当(テストで差し替え可能に)
 * @returns {{
 *   root: HTMLElement,
 *   nodes: Record<string, {
 *     el: HTMLElement,
 *     face: HTMLImageElement,
 *     eyes: HTMLImageElement,
 *     mouth: HTMLImageElement,
 *     bubble: HTMLElement,
 *     think: HTMLElement
 *   }>
 * }}
 */
export function buildCharaLiveStageDom(doc, resolveUrl) {
  const root = doc.createElement('div');
  root.className = 'nlcl-stage';
  // 読み上げと同じ内容を SR にも届ける。会話が流れるので polite(割り込まない)。
  root.setAttribute('aria-live', 'polite');

  /** @type {any} */
  const nodes = {};
  for (const member of CHARA_LIVE_MEMBERS) {
    const el = doc.createElement('div');
    el.className = 'nlcl-chara';
    el.dataset.chara = member.id;

    const stack = doc.createElement('div');
    stack.className = 'nlcl-chara__stack';

    const initial = charaPartPaths(member.id, 'normal', false);
    /**
     * 重ね順(奥→手前): 土台 → 目 → 口。
     *
     * @param {string} part
     * @param {string} src
     * @param {string} alt 土台だけ名前を持たせ、目/口は装飾扱いにする(SR が3回読まない)
     */
    const makeLayer = (part, src, alt) => {
      const img = doc.createElement('img');
      img.className = 'nlcl-chara__layer';
      img.dataset.part = part;
      img.decoding = 'async';
      img.alt = alt;
      if (!alt) img.setAttribute('aria-hidden', 'true');
      img.src = resolveUrl(src);
      return img;
    };
    const face = makeLayer('face', initial.face, member.displayName);
    const eyes = makeLayer('eyes', initial.eyes, '');
    const mouth = makeLayer('mouth', initial.mouth, '');
    stack.append(face, eyes, mouth);

    const bubble = doc.createElement('div');
    bubble.className = 'nlcl-chara__bubble';
    bubble.hidden = true;

    const think = doc.createElement('div');
    think.className = 'nlcl-chara__think';
    think.hidden = true;
    // 「…」の 3 点。装飾なので SR からは隠す。
    think.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i += 1) think.appendChild(doc.createElement('i'));

    el.append(stack, bubble, think);
    root.appendChild(el);
    nodes[member.id] = { el, face, eyes, mouth, bubble, think };
  }
  return { root, nodes };
}

/**
 * 1 フレームぶんを DOM に反映する。
 *
 * ちらつき対策として **変わった時だけ書く**(src/textContent/hidden の無駄な代入をしない)。
 * DOM 書き込みは再レイアウトを誘発するので、毎フレーム 3 体ぶん無条件に書くと重くなる。
 *
 * @param {ReturnType<typeof buildCharaLiveStageDom>['nodes']} nodes
 * @param {ReturnType<typeof import('./charaLiveState.js').buildCharaLiveRenderModel>} model
 * @param {(path: string) => string} resolveUrl
 * @returns {void}
 */
export function applyCharaLiveFrame(nodes, model, resolveUrl) {
  for (const item of model) {
    const node = nodes?.[item.charaId];
    if (!node) continue;

    // ① 重ね絵(土台/目/口)。src は変化時のみ差し替える。
    //    ★土台はまず変わらないが、同じ判定で書いておく(将来 衣装差分が入っても効く)。
    for (const part of /** @type {const} */ (['face', 'eyes', 'mouth'])) {
      const img = node[part];
      const nextSrc = resolveUrl(item.parts[part]);
      if (img.getAttribute('src') !== nextSrc) {
        img.setAttribute('src', nextSrc);
      }
    }

    // ② 位置と姿勢。1 本の transform にまとめる(個別指定の上書き事故を防ぐ)。
    //    ★状態ごとの動き(呼吸/跳ね/回転)は charaLiveState 側で float に足し込み済み。
    //      ここは描くだけ。時刻に依存する計算をこの層に置かない(nowMs を持たない)。
    const { x, y, rotateDeg, scale } = item.float;
    const speaking = item.mode === 'react' || item.mode === 'answer';
    // 喋っている子はほんの少し大きく前に出す。
    const emphasise = speaking ? 1.06 : 1;
    const transform =
      `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) ` +
      `rotate(${(rotateDeg + item.tiltDeg).toFixed(2)}deg) ` +
      `scale(${(scale * emphasise).toFixed(4)})`;
    if (node.el.style.transform !== transform) {
      node.el.style.transform = transform;
    }
    if (node.el.classList.contains('is-speaking') !== speaking) {
      node.el.classList.toggle('is-speaking', speaking);
    }

    // ③ 吹き出し(相槌/返事の本文があるときだけ)。
    const showBubble = speaking && !!item.text;
    if (showBubble) {
      // 名前 + 本文。textContent 経由なので HTML 混入の余地は無い。
      if (node.bubble.dataset.text !== item.text) {
        node.bubble.textContent = '';
        const name = node.bubble.ownerDocument.createElement('b');
        name.className = 'nlcl-chara__name';
        name.textContent = item.displayName;
        node.bubble.append(name, node.bubble.ownerDocument.createTextNode(item.text));
        node.bubble.dataset.text = item.text;
      }
      if (node.bubble.hidden) node.bubble.hidden = false;
    } else if (!node.bubble.hidden) {
      node.bubble.hidden = true;
      delete node.bubble.dataset.text;
    }

    // ④ シンキングの「…」。
    const showThink = item.mode === 'thinking';
    if (node.think.hidden === showThink) node.think.hidden = !showThink;
  }
}

/**
 * 画像を先読みする。パーツが初めて出る瞬間のちらつきを消す。
 *
 * @param {Document} doc
 * @param {(path: string) => string} resolveUrl
 * @returns {HTMLImageElement[]} 参照を保持するための配列(GC で捨てられないように呼び出し側が持つ)
 */
export function preloadCharaLiveImages(doc, resolveUrl) {
  return listCharaLiveImagePaths().map((path) => {
    const img = doc.createElement('img');
    img.decoding = 'async';
    img.src = resolveUrl(path);
    return img;
  });
}

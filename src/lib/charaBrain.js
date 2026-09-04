/**
 * charaBrain.js — 3人の返事を AI に作らせる。
 *
 * ★構成（移植元 tsuioku-no-kirameki.com の作法に合わせた3層）
 *     プロンプトを作る(純関数) → AIを呼ぶ(薄い) → 可否ゲート＋エラー写像(ここ)
 *   人格は charaPersona.v1.js が持ち、ここは呼ぶだけ。
 *
 * ★使うAI: Chrome 内蔵の LanguageModel（Gemini Nano）
 *   実測（2026-09-04・この環境）: availability='available' / 応答 0.6秒 / 日本語OK。
 *   鍵もサーバーも課金も要らない。会話は端末の外に出ない。
 *
 * ★誰が答えるか
 *   名前を呼ばれたらその子。呼ばれなければ「直前に喋った子以外」から選ぶ。
 *   3人が毎回喋ると個性が薄まる（調査:「自由に喋らせると全員が毎ターン喋る」）。
 */

import { PERSONAS, PERSONA_IDS, buildSystemPrompt, DEFAULT_MODE } from './charaPersona.v1.js';
import { detectAddressedChara } from './charaLiveState.js';
import { readMood, moodDirective } from './charaMood.js';
import { readAddress, narrowContext, addressDirective } from './charaAddress.js';

/** @typedef {'rinku'|'konta'|'tanunee'} CharaId */

/**
 * 内蔵AIが使えるか調べる。
 * ★例外を投げない。使えないのは普通のことなので、状態として返す。
 * @returns {Promise<{ok:boolean, state:string, reason?:string}>}
 */
export async function probeAi() {
  const LM = /** @type {any} */ (globalThis).LanguageModel;
  if (!LM || typeof LM.availability !== 'function') {
    return { ok: false, state: 'unavailable', reason: 'この端末では内蔵AIが使えません' };
  }
  try {
    const a = await LM.availability();
    if (a === 'available') return { ok: true, state: a };
    if (a === 'downloadable' || a === 'downloading') {
      return { ok: false, state: a, reason: 'AIモデルの準備中です（初回だけ時間がかかります）' };
    }
    return { ok: false, state: 'unavailable', reason: '内蔵AIが利用できません' };
  } catch (e) {
    return { ok: false, state: 'error', reason: String(e?.message || e) };
  }
}

/**
 * 誰が答えるかを決める。
 * @param {string} text 話しかけられた内容
 * @param {CharaId|null} lastSpeaker 直前に喋った子
 * @returns {CharaId}
 */
export function pickResponder(text, lastSpeaker = null) {
  const named = detectAddressedChara(text);
  if (named) return /** @type {CharaId} */ (named);
  const pool = PERSONA_IDS.filter((id) => id !== lastSpeaker);
  const list = pool.length ? pool : PERSONA_IDS;
  // 決定論にしない（同じことを言っても違う子が答えるほうが自然）
  return /** @type {CharaId} */ (list[Math.floor(Math.random() * list.length)]);
}

/**
 * 返事を1つ作る。
 *
 * ★短さを強制する（プロンプト側でも指示しているが、モデルが長く返すことがあるので後段でも切る）。
 *   声で読むので長い返事は体験を壊す。Grokのプロンプトも全ペルソナで "keep your responses brief"。
 *
 * @param {{ charaId:CharaId, text:string, mode?:string, history?:Array<{who:string,text:string}>, relay?:string }} input
 * @returns {Promise<{ok:boolean, text?:string, ms?:number, reason?:string}>}
 */
export async function think(input) {
  const charaId = input.charaId;
  const persona = PERSONAS[charaId];
  if (!persona) return { ok: false, reason: `unknown chara: ${charaId}` };

  const probe = await probeAi();
  // ★AIが使えなくても黙らない。声は必ず出す。
  //   実際に踏んだ不具合(2026-09-04):「読み上げがない」
  //   → 原因は音声側ではなく、AIが 'downloadable'(準備中) を返して think が失敗し、
  //     返事が作られないまま合成にも到達していなかった。
  //   ★内蔵AIは端末の都合でいつでも準備中になる。**AIの可否に声を依存させてはいけない。**
  if (!probe.ok) {
    return { ok: true, text: fallbackLine(charaId, input.text), ms: 0, fallback: true, reason: probe.reason };
  }

  /* ★その場の空気を判定して、短い一言として渡す
     ★AIに「空気を読め」と書いても読まない。こちらで判定して指示に変える。
     ★相手の状態を説明しない。説明するとモデルがそのまま言葉にする
       （「落ち込んでるんだね」）。どう振る舞うかだけを書く。 */
  const { mood } = readMood(input.history || [], input.text);
  const situation = moodDirective(mood, !!persona.isSafetyNet);

  /* ★リレー中は「その順番での役割」も渡す(2026-09-05)
     受け止める / ずらす / 閉じる を明示しないと、3人が同じことを言う。 */
  /* ★名指しされたときの振る舞い（2026-09-05・Grokに相談して確定）
       - 「たぬ姉の言うとおりだ」= 同意 → 受けるだけ。新しい意見を足さない
       - 直前に別の子が喋っていたら、その**最後の1文**を踏まえる
       - 役割ごとに答え方を変える（受け止める / ずらす / 閉じる）
     ★渡す文脈は4つだけ。それ以上足すと小型モデルは要約し始める。 */
  const addressed = readAddress(input.text);
  const ctx = narrowContext({ text: input.text, charaId, history: input.history });
  const address = addressed.charaId === charaId
    ? addressDirective({ kind: addressed.kind, charaId, prevName: ctx.prevName, prevLine: ctx.prevLine })
    : '';

  const system = buildSystemPrompt(charaId, {
    mode: input.mode || DEFAULT_MODE,
    /* ★指示が重なるとプロンプト上限を超える（実測338字・上限は320〜350）。
       ★名指しの指示は「1文だけ」「役割」まで含んでいるので、
         名指しがあるときは mood の細かい禁止文を落とす。
         受け止める姿勢は名指し側にも入っている。 */
    situation: (address
      ? [address, input.relay].filter(Boolean).join(' ')
      : [situation, input.relay].filter(Boolean).join(' ')) || undefined
  });

  // 直近のやりとりだけ渡す（内蔵AIは小型なので長い履歴は毒）
  // ★履歴にも他の子の名前を出さない（プロンプト本体と同じ理由・Grokの指摘）
  //   「こん太: いいね！」をそのまま見せると、モデルは"使ってよい名前"として受け取る。
  //   誰が言ったかは「相手/あなた/仲間」で足りる（1〜2文の返事に人名は要らない）。
  /* ★名指しされたときは履歴を渡さない。
     直前の1文は address の指示に入れてある。両方渡すと二重になり、
     小型モデルが要約を始める（Grokの指摘）。 */
  const hist = (address ? [] : (input.history || [])).slice(-4)
    .map((h) => {
      if (h.who === '配信者') return `相手: ${h.text}`;
      return h.who === persona.displayName ? `あなた: ${h.text}` : `仲間: ${h.text}`;
    })
    .join('\n');
  // ★「〜ですね」で受け流させない（ユーザー要望:「superficial な返答じゃなく」）
  //   ★オウム返しを名指しで禁じる。Grokのプロンプトが決まり文句を名指しで
  //     禁止しているのと同じ手法（曖昧に「深く返せ」と言っても効かない）。
  const ask =
    `${persona.displayName}として1〜3文で返して。相手の言葉を繰り返すだけの返事はしない。`;
  const user = hist
    ? `これまでの会話:
${hist}

配信者:「${input.text}」

${ask}`
    : `配信者:「${input.text}」

${ask}`;

  const LM = /** @type {any} */ (globalThis).LanguageModel;
  const t0 = performance.now();
  let session;
  try {
    session = await LM.create({ initialPrompts: [{ role: 'system', content: system }] });
    const raw = await session.prompt(user);
    // ★リレー中は1人1文に固定する（指示）。3人ぶん続くので長いと聞き疲れる。
    // ★リレー中と名指し時は1文に固定（Grok:「役割を変えるだけで、長さは揃える」）
    const oneSentence = Boolean(input.relay) || Boolean(address);
    const text = enforcePersona(tidy(raw, oneSentence ? 1 : MAX_SENTENCES), charaId);
    return { ok: true, text, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    // ★ここでも黙らない（上と同じ理由）
    return { ok: true, text: fallbackLine(charaId, input.text), ms: Math.round(performance.now() - t0), fallback: true, reason: String(e?.message || e) };
  } finally {
    try { session?.destroy?.(); } catch { /* no-op */ }
  }
}

/**
 * ★人格をコードで守る（プロンプトだけに頼らない）。
 *
 *   実際に踏んだ不具合(2026-09-04・ユーザーが試して発見):
 *     ① りんくが「りんく、応援してるよ」と【自分の名前で相手を呼んだ】
 *     ② 話しかけた人を「こん太」と呼んだ
 *     ③ 「こんふとし」のような崩れた呼び方が出た
 *   プロンプトで禁止しても、小型モデルは破る。**出力側で機械的に潰す**のが確実。
 *
 * @param {string} text
 * @param {CharaId} charaId
 * @returns {string}
 */
/**
 * ★「のだ」の付け方を直す（純関数）。
 *
 *   実害(2026-09-05):「大丈夫のだ」と言った。
 *   日本語では名詞・形容動詞のあとに「な」が要る:
 *     ○ 大丈夫なのだ / 元気なのだ
 *     × 大丈夫のだ   / 元気のだ
 *   ★動詞・形容詞のあとは「のだ」のまま（「聞くのだ」「いいのだ」）。
 *     そこまで直すと逆に壊すので、**名詞・形容動詞だけ**を対象にする。
 *
 * @param {string} text
 * @returns {string}
 */
export function fixNoda(text) {
  let t = String(text || '');
  /* ★「〜な」で終わる語のあとに付いた「のだ」を「なのだ」にする。
     よく出るものだけを名指しで直す。網羅は狙わない（誤変換の方が害が大きい）。 */
  const NEEDS_NA = [
    '大丈夫', '元気', '好き', '嫌い', '無理', '得意', '苦手',
    '大事', '大切', '静か', '綺麗', 'きれい', '素敵', 'すてき',
    '幸せ', '心配', '残念', '十分', 'じゅうぶん', '自由', '本当', 'ほんと'
  ];
  for (const w of NEEDS_NA) {
    // 「大丈夫のだ」→「大丈夫なのだ」（すでに「なのだ」なら触らない）
    t = t.replace(new RegExp(w + 'のだ', 'g'), w + 'なのだ');
  }
  return t;
}

export function enforcePersona(text, charaId) {
  let t = String(text || '');
  const p = PERSONAS[charaId];
  if (!p) return t;

  // ★人名での呼びかけを落とす（「りんく、〜」「こん太！」など先頭・末尾の呼びかけ）
  const names = PERSONA_IDS.map((id) => PERSONAS[id].displayName);
  for (const n of names) {
    t = t.replace(new RegExp(`^${n}[、,。！!？?\s]+`), '');   // 文頭の呼びかけ
    t = t.replace(new RegExp(`[、,]\s*${n}[、,。！!？?]*$`), ''); // 文末の呼びかけ
    t = t.replace(new RegExp(`[、,]?\s*${n}[、,]\s*`), '');   // 文中の呼びかけ
  }

  /* ★他の子の語尾が混ざったら直す（「のだ」は りんく 専用）
     ★実害(2026-09-04): split/join で**文中からも消して**いたため
       「気にしなくていいのだ！」→「気にしなくていい！」と日本語が壊れていた。
     → 文末の語尾だけを落とす。文中は触らない。 */
  for (const ng of p.speech.forbidden) {
    if (ng.startsWith('〜')) continue;
    // 「〜のだ。」「〜のだ！」「〜のだ」の形だけを対象にする
    const re = new RegExp(ng + '([。！？!?]|$)', 'g');
    t = t.replace(re, '$1');
  }

  /* ★二人称を子ごとに直す（2026-09-04・実害）
     こん太が「あなたっていつも頑張ってるから」と返した。
     ★プロンプトで指示しても小型モデルは破る。出力側でも直す。
     ★「あなた」以外の二人称は触らない（言い換えると文が壊れる）。 */
  if (p.secondPerson && p.secondPerson !== 'あなた') {
    t = t.replace(/あなた/g, p.secondPerson);
  }
  // ★「のだ」を使う子だけ、付け方を直す（「大丈夫のだ」→「大丈夫なのだ」）
  if (p.speech.ending === 'のだ') t = fixNoda(t);

  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || '……';
}

/**
 * 返答を声で読める形に整える。
 * ★記号・箇条書き・鉤括弧を落とす。長すぎたら1文目で切る。
 * @param {unknown} raw
 * @returns {string}
 */
/**
 * @param {unknown} raw
 * @param {number} [maxSentences] リレー中は1に絞る
 */
export function tidy(raw, maxSentences = MAX_SENTENCES) {
  let t = String(raw ?? '').trim();
  // よくある前置きを落とす
  t = t.replace(/^(はい[、。]?|わかりました[、。]?|了解[、。]?)/, '').trim();
  // 記号・箇条書き・絵文字っぽいものを除去（声で読むため）
  t = t.replace(/^[「『]|[」』]$/g, '').replace(/^[-*・]\s*/gm, '');
  t = t.replace(/\s*\n+\s*/g, ' ').trim();
  // ★文の数で切る（ユーザー要望「返答は1〜3文。必要なら追加で1文」）
  t = limitSentences(t, maxSentences);

  // ★全体の字数でも切る（2026-09-04・本物のAIで実害を確認）
  //   実際に返ってきたもの:
  //     「そんなこと気にしなくていいのだ！あなたなら絶対フォロワー増やすことが
  //       できる、信じてるのだ！誰よりも面白い配信してくれるから、きっとすぐに
  //       たくさんの人が集まるはずのだ」
  //   ★3文だが82字。文数の条件は満たすのに長すぎ、吹き出しも途中で切れた。
  //   ★字数だけ見ていた頃の反省で文数に切り替えたが、それも片手落ちだった。
  //     声で読む以上、**文の数と全体の字数の両方**が要る。
  t = limitChars(t, MAX_CHARS);
  return t;
}

/** 返事の字数の上限。★声で読んで自然に聞ける長さ。 */
export const MAX_CHARS = 48;

/**
 * 字数で切る（純関数）。★文の途中では切らない。
 *   途中で切ると「集まるはず…」のような尻切れになり、機械っぽさが増す。
 *   上限を超えたら、超えない範囲の**最後の文まで**で止める。
 *
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function limitChars(text, max = MAX_CHARS) {
  const t = String(text || '').trim();
  if (t.length <= max) return t;

  const parts = t.match(/[^。！？!?]+[。！？!?]?/g) || [t];
  let out = '';
  for (const part of parts) {
    if ((out + part).length > max) break;
    out += part;
  }
  // ★1文目からして長い場合だけ、やむを得ず途中で切る
  if (!out) return t.slice(0, max - 1) + '…';
  return out.trim();
}

/** ★返事の上限。3文まで（必要な1文の追加を含めて4文は超えない）。 */
export const MAX_SENTENCES = 3;

/**
 * 文の数で切る（純関数）。
 *
 * ★「必要なら追加で1文」への対処:
 *   3文目が接続で終わっている（「でも」「だから」等で次に続く形）ときだけ4文目を許す。
 *   ★言い切って終われるならそこで止めるのが基本。
 *
 * @param {string} text
 * @param {number} max
 * @returns {string}
 */
export function limitSentences(text, max = MAX_SENTENCES) {
  const t = String(text || '').trim();
  if (!t) return '';
  // 句点・感嘆符・疑問符で区切る（末尾に句点が無い文も拾う）
  const parts = t.match(/[^。！？!?]+[。！？!?]?/g) || [t];
  if (parts.length <= max) return t;

  let kept = parts.slice(0, max).join('').trim();
  // ★3文目が続きを求める形なら、4文目まで許す（途中で切ると意味が壊れる）
  if (/(でも|だから|けど|though|ので|から)$/.test(kept.replace(/[。！？!?]$/, ''))) {
    kept = parts.slice(0, max + 1).join('').trim();
  }
  return kept;
}

/**
 * ★AIが使えないときの返事。**黙るより喋る**。
 *
 *   人格は charaPersona.v1.js の口調に合わせる（ここで新しい人格を作らない）。
 *   相手の名前は呼ばない（enforcePersona と同じ理由）。
 *
 * @param {CharaId} charaId
 * @param {string} said 話しかけられた内容（疑問形かどうかだけ見る）
 * @returns {string}
 */
export function fallbackLine(charaId, said = '') {
  const asked = /[?？]\s*$|ですか|かな$|どう(思う|かな)/.test(String(said));
  const table = {
    rinku: asked ? ['ボクはいいと思うのだ！', 'だいじょうぶなのだ！'] : ['うんうん、聞いてるのだ', 'いいと思うのだ！'],
    konta: asked ? ['ボクはいいと思うよ！', 'やってみたらいいよ！'] : ['ボク見てたよ、ちゃんと！', 'いまのよかったー！'],
    tanunee: asked ? ['まあ、やってみればいいのよ', 'そりゃ、あなたが決めることよ'] : ['ふーん、そうなの', 'まあ、いいんじゃない']
  };
  const list = table[charaId] || table.rinku;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * ★AIモデルの取得を始める。**クリックの中から呼ぶこと。**
 *
 *   実測で判明した仕様(2026-09-04):
 *     availability が 'downloadable' のとき create() を呼ぶと
 *     NotAllowedError: Requires a user gesture when availability is
 *     "downloading" or "downloadable".
 *   → ★**待っていても永久に始まらない**。ユーザーの操作が要る。
 *     「準備中です」と出すだけでは、いつまでも準備中のまま。
 *     取得を始めるボタンを必ず用意する。
 *
 * @param {(loaded:number)=>void} [onProgress] 0..1
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function startAiDownload(onProgress) {
  const LM = /** @type {any} */ (globalThis).LanguageModel;
  if (!LM?.create) return { ok: false, reason: 'この端末では内蔵AIが使えません' };
  try {
    const session = await LM.create({
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => {
          try { onProgress?.(Number(e.loaded) || 0); } catch { /* no-op */ }
        });
      }
    });
    try { session.destroy?.(); } catch { /* no-op */ }
    return { ok: true };
  } catch (e) {
    const msg = String(e?.message || e);
    // ★クリック外から呼ばれた場合は、その旨をそのまま伝える(黙って失敗させない)
    if (/user gesture/i.test(msg)) {
      return { ok: false, reason: 'ボタンを押して開始してください（ブラウザの決まりです）' };
    }
    return { ok: false, reason: msg };
  }
}

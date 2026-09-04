/**
 * charaVoicePicker.js — 3人の声を配信者が選べるようにする。
 *
 * ★なぜ必要か（2026-09-04 ユーザー指摘）
 *   ユーザーの言葉:「みるとどの音声入力かえらべるのがない」
 *   その前段:「りんくと声がちがう」
 *   → ★**開発者が決めた声が、その人にとって正解とは限らない。**
 *     styleId は実測で正しく送れていた。それでも「違う」と感じられた。
 *     つまり不具合ではなく**選択肢が無いことが問題**だった。
 *
 * ★Grok と同じ形にする（ユーザー提示の実画面が根拠）
 *   Grokは画面最上部に「音声 Ara ＞」を置き、**性格と声を別々に**選ばせている。
 *   → 声の選択は性格モードから独立させる。組み合わせは自由。
 *
 * ★こちらの優位: VOICEVOX は実測 **43話者 / 127スタイル**。Grokの声は数個。
 *   ただし ★**数が多いことは、そのままでは価値にならない。**
 *   名前（「四国めたん ノーマル」等）を読んでも、どんな声かは分からない。
 *   → **押したら鳴る**ことが必須。聞かずに選ばせない。
 *
 * ★保存は localStorage（毎回選ばせない）。
 *   人格(charaPersona.v1.js)は版で固定するが、**声は動かしてよい**。
 *   声は「人格の変更」ではなく好みの調整だから（Grokも声だけ差し替えられる）。
 */

import { PERSONAS, PERSONA_IDS } from './charaPersona.v1.js';
import { listSpeakers } from './charaVoice.js';

const STORAGE_KEY = 'characterlive.voice.v1';

/**
 * 話者一覧を「選ばせるための平らな配列」にする（純関数）。
 *
 * ★VOICEVOX の /speakers は 話者 > スタイル の入れ子。
 *   選ぶ単位は **スタイル**（同じ話者でも「ノーマル」と「セクシー」は別の声）なので平らにする。
 *
 * @param {Array<{name:string, styles:Array<{name:string,id:number}>}>} speakers
 * @returns {Array<{styleId:number, label:string, speaker:string, style:string}>}
 */
export function flattenSpeakers(speakers) {
  const out = [];
  for (const sp of speakers || []) {
    for (const st of sp.styles || []) {
      out.push({
        styleId: Number(st.id),
        speaker: sp.name,
        style: st.name,
        label: `${sp.name} ${st.name}`
      });
    }
  }
  return out;
}

/**
 * 保存された声を読む。壊れていたら既定に戻す（例外にしない）。
 * @returns {Record<string, number>} charaId → styleId
 */
export function loadVoices(storage = globalThis.localStorage) {
  const fallback = defaultVoices();
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    const out = { ...fallback };
    for (const id of PERSONA_IDS) {
      const v = Number(saved?.[id]);
      // ★数値でないものは無視する（壊れた保存で声が出なくなるのを防ぐ）
      if (Number.isFinite(v) && v >= 0) out[id] = v;
    }
    return out;
  } catch {
    return fallback;
  }
}

/**
 * 声を保存する。
 * @returns {boolean} 保存できたか（privateモード等で失敗しても会話は止めない）
 */
export function saveVoices(voices, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(voices));
    return true;
  } catch {
    return false;
  }
}

/** 人格ファイルが持つ既定の声（実測で確定した 8 / 32 / 14）。 */
export function defaultVoices() {
  const out = {};
  for (const id of PERSONA_IDS) out[id] = PERSONAS[id].voice.styleId;
  return out;
}

/** 既定に戻す（★「元の声に戻せる」は必須。戻せないと怖くて試せない）。 */
export function resetVoices(storage = globalThis.localStorage) {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* no-op */ }
  return defaultVoices();
}

/**
 * 試聴用の台詞。★その子の口調で喋らせる（声だけ聞いても選べないため）。
 * @param {string} charaId
 */
export function sampleLine(charaId) {
  const p = PERSONAS[charaId];
  return p?.speech?.examples?.[0] || 'こんにちは';
}

/** 一覧を取りに行く（薄い）。失敗したら空配列＝画面は「声の変更は使えません」で成立させる。 */
export async function fetchVoiceChoices() {
  try {
    return flattenSpeakers(await listSpeakers());
  } catch {
    return [];
  }
}

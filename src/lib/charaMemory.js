/**
 * charaMemory.js — セッションをまたいで「前に話したこと」を1つだけ拾う（純関数）。
 *
 * ★根拠（2026-09-14・本調査 採用5）
 *   「前に話したことを1つだけ拾って言及する」が愛着の核（ComPeer：昨日の学業の重圧を覚えていて励ました→高評価）。
 *   逆に「記憶がない」が最大の離脱理由。★ただし多く並べない。1つだけ。
 *   Grok 側の規則案でも「約束・日時を覚えて出すのは応援役だけ」「固有情報は直近1つ」。
 *
 * ★何を覚えるか
 *   配信者の発話だけ。キャラの返事は覚えない（自分の言葉を"前に話したこと"として出すのは変）。
 *   相槌だけの短い発話は捨てる。
 *
 * ★どこに置くか
 *   呼び出し側が localStorage に持つ（このモジュールは状態を持たない・DOM を触らない）。
 *   ★会話の本文を端末の外に出さない方針は変わらない（保存先は端末内だけ）。
 */

/** 覚えておく件数の上限 */
export const MEMORY_MAX = 30;
/** これより古いものは拾わない（7日） */
export const MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** これより新しいものは「前回」ではなく「今回」なので拾わない（10分） */
export const MEMORY_MIN_AGE_MS = 10 * 60 * 1000;
/** 拾う1件の長さ */
export const MEMORY_LINE_CHARS = 40;

/** @typedef {{ text:string, tMs:number }} MemoryItem */

/**
 * 発話を1つ覚える。★短い相槌は捨てる。同じ文は上書きしない（古い方を残す）。
 * @param {MemoryItem[]} items
 * @param {{ text:string, tMs:number }} said
 * @returns {MemoryItem[]} 新しい配列（元は変えない）
 */
export function remember(items, said) {
  const text = String(said?.text || '').trim();
  const tMs = Number(said?.tMs);
  if (text.length < 6 || !Number.isFinite(tMs)) return items || [];
  const list = (items || []).filter((it) => it && typeof it.text === 'string');
  if (list.some((it) => it.text === text)) return list;
  return list.concat([{ text: text.slice(0, MEMORY_LINE_CHARS), tMs }]).slice(-MEMORY_MAX);
}

/**
 * 「前に話したこと」を1つだけ選ぶ。★最新の"前回"を返す（10分より前・7日以内）。
 * @param {MemoryItem[]} items
 * @param {number} nowMs
 * @returns {string} 無ければ ''
 */
export function pickup(items, nowMs) {
  const now = Number(nowMs);
  if (!Number.isFinite(now)) return '';
  const ok = (items || []).filter((it) => {
    const age = now - Number(it?.tMs);
    return Number.isFinite(age) && age >= MEMORY_MIN_AGE_MS && age <= MEMORY_TTL_MS && it.text;
  });
  if (!ok.length) return '';
  return ok[ok.length - 1].text;
}

/**
 * 頭脳に渡す一言。★指示は短く、「1つだけ・自然に」。
 * @param {string} line
 * @returns {string} 無ければ ''
 */
export function memoryDirective(line) {
  const l = String(line || '').trim();
  if (!l) return '';
  return `前に相手が「${l}」と言っていた。触れるなら1つだけ、自然に。毎回は触れない。`;
}

/** localStorage 文字列との変換（壊れていたら空にする・例外を投げない） */
export function parseMemory(raw) {
  try {
    const v = JSON.parse(String(raw || '[]'));
    return Array.isArray(v) ? v.filter((it) => it && typeof it.text === 'string' && Number.isFinite(Number(it.tMs))) : [];
  } catch {
    return [];
  }
}
export function serializeMemory(items) {
  return JSON.stringify((items || []).slice(-MEMORY_MAX));
}

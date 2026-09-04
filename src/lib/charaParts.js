/**
 * charaParts.js
 *
 * キャラ＋表情＋口の状態 から【重ねる3枚のパーツパス】を返す。
 *
 * ★移植元(追憶のきらめき)との唯一の設計差:
 *   移植元 yukkuriBroadcastSummary.js の yukkuriCharacterImagePath は
 *   「合成済み1枚のパス」を返していた。ここでは【土台/目/口の3枚】を返す。
 *
 * ★なぜパーツ方式か(kimito-link.com/free-assets/ の自社仕様):
 *   すべて 1500x1500px・同じ位置でぴったり重なる透過PNG。
 *   顔ベースの上に目と口を重ねるだけでアニメーションが作れる。
 *
 *   合成済み(8通り固定)では【口パク中にまばたきできない】。
 *   パーツなら目と口が独立して動く = 喋りながら瞬きできる。
 *   表情を足すのも重ね方を変えるだけで済む(絵を描き足さなくてよい)。
 *
 * ★座標合わせは不要(同じ位置で重なる仕様)。CSS で全レイヤーを
 *   同じ矩形に敷くだけで合う(charaLiveStage.css の .nlcl-chara__layer)。
 */

/** @typedef {'rinku'|'konta'|'tanunee'} CharaId */
/** @typedef {'smile'|'blink'|'half-eyes'|'normal'} CharaExpression */

/**
 * キャラごとのパーツ置き場とファイル名の頭。
 * ★正本は kimito-link/src/images/yukkuri-character-parts/。
 *   ここへは取り込み済み(assets/characters/)。ファイル名は正本のまま変えない
 *   = 正本を更新したとき単純コピーで差し替えられる。
 */
const CHAR_BASE = Object.freeze({
  rinku: 'assets/characters/link/link-yukkuri',
  konta: 'assets/characters/konta/kitsune-yukkuri',
  tanunee: 'assets/characters/tanunee/tanuki-yukkuri'
});

/**
 * 表情 → 目パーツのファイル名接尾辞。
 *
 * ★状態機械(charaLiveState.js)が出す表情名と、実ファイル名は綴りが違う:
 *   'half-eyes'(状態機械) → 'eyes-half'(ファイル)。ここで吸収する。
 *   ★これを states 側に合わせて改名しない: 正本(kimito-link)のファイル名を
 *     変えると、正本を更新するたびに手直しが要る。
 */
const EYES_BY_EXPRESSION = Object.freeze({
  normal: 'eyes-normal',
  smile: 'eyes-smile',
  blink: 'eyes-blink',
  'half-eyes': 'eyes-half'
});

/** 目の既定(未知の表情が来ても壊れ画像を出さない)。 */
const EYES_FALLBACK = 'eyes-normal';

/**
 * 重ねる3枚のパスを返す。順序がそのまま重ね順(奥→手前)。
 *
 * ★合成済み方式と違い konta の分岐が要らない:
 *   移植元は konta だけ normal 単独ファイルを持つ地雷を抱えていたが、
 *   パーツは3キャラとも同じ7枚構成なので分岐が消える。
 *
 * @param {CharaId|string} character
 * @param {CharaExpression|string} expression
 * @param {boolean} mouthOpen
 * @returns {{ face: string, eyes: string, mouth: string }}
 */
export function charaPartPaths(character, expression, mouthOpen) {
  const base = CHAR_BASE[/** @type {CharaId} */ (character)] || CHAR_BASE.rinku;
  const eyes = EYES_BY_EXPRESSION[/** @type {CharaExpression} */ (expression)] || EYES_FALLBACK;
  return {
    face: `${base}-face-base.png`,
    eyes: `${base}-${eyes}.png`,
    mouth: `${base}-mouth-${mouthOpen ? 'open' : 'closed'}.png`
  };
}

/**
 * 先読みすべきパーツの一覧(重複なし)。
 *
 * ★合成済みなら 3キャラ×表情4×口2 = 24枚だったが、
 *   パーツなら 3キャラ×7枚 = 21枚で【全組み合わせ】を賄える。
 *   組み合わせが増えても先読み枚数は増えない = パーツ方式の効き目。
 *
 * @returns {string[]}
 */
export function listCharaPartPaths() {
  /** @type {Set<string>} */
  const out = new Set();
  for (const id of /** @type {CharaId[]} */ (Object.keys(CHAR_BASE))) {
    for (const expression of /** @type {const} */ (['normal', 'smile', 'blink', 'half-eyes'])) {
      for (const mouthOpen of [false, true]) {
        const parts = charaPartPaths(id, expression, mouthOpen);
        out.add(parts.face);
        out.add(parts.eyes);
        out.add(parts.mouth);
      }
    }
  }
  return [...out];
}

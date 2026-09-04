/**
 * index.js — characterlive の唯一の入口。
 *
 * 使う側はこれだけ import すればよい:
 *   import { startCharaLive } from './src/index.js';
 *   const live = startCharaLive({ doc: document, mount: el, resolveUrl: (p) => p });
 *
 * ★このリポの責務は【見た目と動きだけ】。
 *   何を喋るか(会話AI)・声(VOICEVOX)・配信サイト連携は【入っていない】。
 *   ただし受け口は開いている: onStreamerAddressed / beginThinking / endThinking。
 */

export { startCharaLive, CHARA_BACKCHANNELS, CHARA_LIVE_FPS } from './lib/charaLiveController.js';
export {
  CHARA_LIVE_MEMBERS,
  CHARA_LIVE_IDS,
  makeInitialCharaLiveState,
  buildCharaLiveRenderModel,
  resolveCharaLiveLook,
  detectAddressedChara
} from './lib/charaLiveState.js';
export { charaPartPaths, listCharaPartPaths } from './lib/charaParts.js';
export {
  charaLiveStageCss,
  buildCharaLiveStageDom,
  applyCharaLiveFrame,
  listCharaLiveImagePaths,
  CHARA_LIVE_SIZE_PX
} from './lib/charaLiveStage.js';
export { collectCharaLiveCensus, charaLiveVerdict } from './lib/charaLiveCensus.js';

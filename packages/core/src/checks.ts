import { handTotal, playableCards } from './cards';
import {
  ARM_MAX_TOTAL,
  type Card,
  type Check,
  type GameState,
  type PlayerId,
} from './types';

const OK: Check = { ok: true };
const no = (reason: Extract<Check, { ok: false }>['reason']): Check => ({ ok: false, reason });

/** 次のプレイヤーの最初の操作が、判定待ちで止められている状態か(spec 6-3) */
export function isResolutionPending(state: GameState): boolean {
  return state.phase === 'awaitAction' && state.dobonWindowOpen && state.declarations.length > 0;
}

/** プレイボタンを押せるか(spec 4-3)。カードの中身は見ない */
export function checkPlay(state: GameState, player: PlayerId): Check {
  if (state.phase === 'finished') return no('gameFinished');
  if (state.phase === 'startWindow') return no('wrongPhase');
  if (player !== state.currentPlayer) return no('notYourTurn');
  if (state.phase === 'accept') return no('wrongPhase');
  if (isResolutionPending(state)) return no('resolutionPending');
  const hand = state.hands[player];
  if (state.phase === 'awaitAction' && hand.length < 2) return no('mustDrawFirst');
  if (playableCards(hand, state.topCard).length === 0) return no('noPlayableCard');
  return OK;
}

/** ドローボタンを押せるか。山札が0枚のときの扱いは applyAction 側(引き分け) */
export function checkDraw(state: GameState, player: PlayerId): Check {
  if (state.phase === 'finished') return no('gameFinished');
  if (state.phase === 'startWindow') return no('wrongPhase');
  if (player !== state.currentPlayer) return no('notYourTurn');
  if (state.phase === 'afterDraw') return no('alreadyDrew');
  if (state.phase === 'accept') return no('wrongPhase');
  const hand = state.hands[player];
  if (hand.length >= 2 && playableCards(hand, state.topCard).length > 0) {
    return no('hasPlayableCard');
  }
  // 山札が0枚のときは、先に判定してから引き分け(M-6)。ここでは止めない
  if (isResolutionPending(state) && state.stock.length > 0) return no('resolutionPending');
  return OK;
}

/** パスボタンを押せるか。パスはドローの後で、出せるカードがないときだけ */
export function checkPass(state: GameState, player: PlayerId): Check {
  if (state.phase === 'finished') return no('gameFinished');
  if (state.phase === 'startWindow') return no('wrongPhase');
  if (player !== state.currentPlayer) return no('notYourTurn');
  if (state.phase === 'awaitAction') return no('drawFirst');
  if (state.phase === 'accept') return no('wrongPhase');
  if (playableCards(state.hands[player], state.topCard).length > 0) return no('hasPlayableCard');
  return OK;
}

/** 張るボタンを押せるか(spec 5-1)。押した時点の合計が13以下で、開始時の受付か自分のターン */
export function checkArm(state: GameState, player: PlayerId): Check {
  if (state.phase === 'finished') return no('gameFinished');
  if (state.armed[player] || state.provisionalArm[player]) return no('alreadyArmed');
  if (state.phase !== 'startWindow' && player !== state.currentPlayer) return no('notYourTurn');
  if (handTotal(state.hands[player]) > ARM_MAX_TOTAL) return no('totalTooHigh');
  return OK;
}

/**
 * ドボンの操作を受け付けるか(M-4)。
 * ここが ok でも、受付の時間外なら「無効」になる(チョンボにはならない)。
 */
export function checkDobon(state: GameState, player: PlayerId): Check {
  if (state.phase === 'finished') return no('gameFinished');
  if (!state.armed[player]) return no('notArmed');
  if (state.topCardPlayedBy === null) return no('startingTopCard');
  if (state.topCardPlayedBy === player) return no('ownCard');
  if (state.declarations.includes(player)) return no('alreadyDeclared');
  return OK;
}

export interface TurnOptions {
  readonly play: Check;
  readonly draw: Check;
  readonly pass: Check;
  readonly arm: Check;
  readonly dobon: Check;
  /** いま出せるカード(場札と同じ数字か同じマーク) */
  readonly playableCards: readonly Card[];
}

/** 画面のボタンを、押せるか・押せない理由つきで出すための一覧 */
export function getTurnOptions(state: GameState, player: PlayerId): TurnOptions {
  return {
    play: checkPlay(state, player),
    draw: checkDraw(state, player),
    pass: checkPass(state, player),
    arm: checkArm(state, player),
    dobon: checkDobon(state, player),
    playableCards: playableCards(state.hands[player], state.topCard),
  };
}

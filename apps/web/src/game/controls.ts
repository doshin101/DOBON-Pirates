import {
  getTurnOptions,
  isPlayable,
  sameCard,
  type ActionErrorCode,
  type Card,
  type Check,
} from '@dobon/core';
import { HUMAN, type Snapshot } from './GameRunner';

/** ボタン1つの状態。押せないときは、理由(ActionErrorCode)を持つ */
export interface ButtonState {
  readonly enabled: boolean;
  readonly reason: ActionErrorCode | null;
}

/**
 * 手札のカード1枚の状態(spec 4-4)
 * - selected:選んでいる(持ち上げる)
 * - selectable:選べる
 * - unplayable:そもそも出せない(暗くする)
 * - blocked:他のカードを選んだので、今は選べない(薄く点線)
 */
export type CardState = 'selected' | 'selectable' | 'unplayable' | 'blocked';

export interface HumanControls {
  readonly canAct: boolean;
  readonly play: ButtonState;
  readonly draw: ButtonState;
  readonly pass: ButtonState;
  /** 張るボタン(M2:表示だけ。押しても何も起きない) */
  readonly arm: ButtonState;
  readonly cardStates: readonly CardState[];
}

const fromCheck = (check: Check): ButtonState =>
  check.ok ? { enabled: true, reason: null } : { enabled: false, reason: check.reason };

/**
 * 画面のボタンとカードの状態を決める。
 * 人間が操作できるのは、自分のターンの②③(stage が action)のときだけ。
 * `hand` は画面に出している並び順の手札、`selected` は選んでいるカード。
 */
export function getHumanControls(
  snapshot: Snapshot,
  hand: readonly Card[],
  selected: Card | null,
): HumanControls {
  const { state, stage } = snapshot;
  const options = getTurnOptions(state, HUMAN);
  const myTurn = state.currentPlayer === HUMAN && state.phase !== 'finished';
  const canAct = myTurn && stage === 'action';

  // 自分のターンでも①(表示中)や④の間は押せないが、理由は出さない(すぐ変わるため)。
  // 自分のターンでないときは、core が返す理由(自分の番ではありません)を出す
  const gate = (check: Check): ButtonState => {
    if (canAct) return fromCheck(check);
    return { enabled: false, reason: myTurn || check.ok ? null : check.reason };
  };

  const holding = canAct && selected !== null && hand.some((c) => sameCard(c, selected)) ? selected : null;

  const playCheck = options.play;
  // プレイは、出せるカードを1枚選んでいるときだけ押せる(選んでいないときは理由なし)
  const play: ButtonState = gate(playCheck);
  const playNow: ButtonState = canAct && play.enabled && !holding ? { enabled: false, reason: null } : play;

  const cardStates = hand.map((card): CardState => {
    if (!canAct || !playCheck.ok || !isPlayable(card, state.topCard)) return 'unplayable';
    if (holding) return sameCard(card, holding) ? 'selected' : 'blocked';
    return 'selectable';
  });

  return {
    canAct,
    play: playNow,
    draw: gate(options.draw),
    pass: gate(options.pass),
    arm: fromCheck(options.arm),
    cardStates,
  };
}

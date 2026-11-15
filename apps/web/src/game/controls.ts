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

/**
 * メインボタン(張る / ドボン)の状態(wireframe.html の下の表)
 * - arm:「張る」。押せないときは理由つき
 * - armReserved:「張る(予約中)」。取り消せない
 * - dobon:張っているとき。mode が
 *   ready=受付中で他の人のカード(上フリックで宣言できる)/ closed=受付の時間外(フリックしても無効)/
 *   notTarget=最初の場札か自分のカード(受け付けない)/ judging=宣言ずみ(判定待ち)
 */
export type MainState =
  | { readonly kind: 'arm'; readonly enabled: boolean; readonly reason: ActionErrorCode | null }
  | { readonly kind: 'armReserved' }
  | { readonly kind: 'dobon'; readonly mode: 'ready' | 'closed' | 'notTarget' | 'judging' };

export interface HumanControls {
  readonly canAct: boolean;
  readonly play: ButtonState;
  readonly draw: ButtonState;
  readonly pass: ButtonState;
  readonly main: MainState;
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
  // 自分のターンでないときは、core が返す理由(自分の番ではありません)を出す。
  // 猶予の間(判定待ち)は、理由は「判定中」
  const gate = (check: Check): ButtonState => {
    if (stage === 'grace') {
      return { enabled: false, reason: myTurn ? 'resolutionPending' : check.ok ? null : check.reason };
    }
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
    main: getMainState(snapshot, options.arm, options.dobon, myTurn),
    cardStates,
  };
}

function getMainState(snapshot: Snapshot, armCheck: Check, dobonCheck: Check, myTurn: boolean): MainState {
  const { state, stage } = snapshot;
  const over = stage === 'flash' || stage === 'ended' || state.phase === 'finished';

  if (state.armed[HUMAN]) {
    if (state.declarations.includes(HUMAN) && !over) return { kind: 'dobon', mode: 'judging' };
    if (over) return { kind: 'dobon', mode: 'closed' };
    if (!dobonCheck.ok) return { kind: 'dobon', mode: 'notTarget' }; // 最初の場札 / 自分のカード
    return { kind: 'dobon', mode: state.dobonWindowOpen ? 'ready' : 'closed' };
  }
  if (state.provisionalArm[HUMAN]) return { kind: 'armReserved' };

  // 張れるのは、開始時の受付中と、自分のターンの②③④(①は表示だけ)
  const canArmNow = stage === 'startWindow' || (myTurn && (stage === 'action' || stage === 'accept'));
  if (!canArmNow) {
    return { kind: 'arm', enabled: false, reason: myTurn || over || stage === 'grace' ? null : 'notYourTurn' };
  }
  return armCheck.ok
    ? { kind: 'arm', enabled: true, reason: null }
    : { kind: 'arm', enabled: false, reason: armCheck.reason };
}

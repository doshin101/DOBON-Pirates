// テスト用の道具(本番のコードからは読まない)
import { applyAction } from './game';
import type { Action, ApplyResult, Card, GameEvent, GameState, Rank, Suit } from './types';

/** カードを短く書く。例: c('H9')、c('SA')、c('DK') */
export function c(code: string): Card {
  const suit = code[0] as Suit;
  const text = code.slice(1);
  const named: Record<string, Rank> = { A: 1, J: 11, Q: 12, K: 13 };
  const rank = (named[text] ?? Number(text)) as Rank;
  return { suit, rank };
}

export function hand(...codes: string[]): Card[] {
  return codes.map(c);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

/**
 * 好きな場面を作る。決めなかった項目の初期値:
 * 手番は 0、②操作待機、場札は H9(3番がプレイ)、全員の手札は [C4, C5](合計9)、
 * 誰も張っていない、山札は [SK, SQ, SJ]。
 * 作った状態は凍結してあるので、core が元の状態を書き換えるとテストが落ちる。
 */
export function makeState(overrides: Partial<GameState> = {}): GameState {
  const base: GameState = {
    stock: [c('SK'), c('SQ'), c('SJ')],
    hands: [hand('C4', 'C5'), hand('C4', 'C5'), hand('C4', 'C5'), hand('C4', 'C5')],
    discard: [c('H9')],
    topCard: c('H9'),
    topCardPlayedBy: 3,
    startingPlayer: 0,
    currentPlayer: 0,
    phase: 'awaitAction',
    armed: [false, false, false, false],
    provisionalArm: [false, false, false, false],
    armedAtTurnStart: false,
    dobonWindowOpen: false,
    declarations: [],
    turnCount: 1,
    result: null,
  };
  return deepFreeze({ ...base, ...overrides });
}

/** 受け付けられるはずの操作を順に実行する。失敗したら例外 */
export function run(
  state: GameState,
  ...actions: Action[]
): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const action of actions) {
    const result = applyAction(current, action);
    if (!result.ok) {
      throw new Error(`操作が受け付けられなかった: ${JSON.stringify(action)} → ${result.error}`);
    }
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

export function attempt(state: GameState, action: Action): ApplyResult {
  return applyAction(state, action);
}

/** 失敗の理由だけ取り出す(成功したら 'ok') */
export function errorOf(state: GameState, action: Action): string {
  const result = applyAction(state, action);
  return result.ok ? 'ok' : result.error;
}

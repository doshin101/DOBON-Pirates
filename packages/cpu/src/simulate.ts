import {
  PLAYER_IDS,
  applyAction,
  createGame,
  createRng,
  getPlayerView,
  nextPlayer,
  type Action,
  type GameEvent,
  type GameResult,
  type GameState,
} from '@dobon/core';
import { decide, toAction } from './decide';

export interface SimulationOptions {
  /** 止まらないかの見張り。これを超えたら例外にする */
  readonly maxSteps?: number;
  /** true なら、起きたこと(イベント)を全部記録する */
  readonly recordEvents?: boolean;
}

export interface SimulationResult {
  readonly seed: number;
  readonly result: GameResult;
  /** 始まったターンの数 */
  readonly turns: number;
  /** ゲーム中の、誰かの手札の最大枚数 */
  readonly maxHandSize: number;
  readonly steps: number;
  readonly events: readonly GameEvent[];
  readonly finalState: GameState;
}

/**
 * CPU4人だけで1ゲーム遊ぶ。時間は扱わない(待ち時間は省いて、順番だけ再現する)。
 * 乱数は1つのシード付き乱数を、配りとCPUの選択で順に使うので、同じシードなら同じ展開になる。
 */
export function simulateGame(seed: number, options: SimulationOptions = {}): SimulationResult {
  const maxSteps = options.maxSteps ?? 10_000;
  const rng = createRng(seed);
  const created = createGame(rng);
  let state = created.state;
  const events: GameEvent[] = options.recordEvents ? [...created.events] : [];
  let maxHandSize = 3;
  let steps = 0;

  const apply = (action: Action): void => {
    const result = applyAction(state, action);
    if (!result.ok) {
      throw new Error(
        `シード ${seed}: 受け付けられない操作 ${JSON.stringify(action)} → ${result.error}`,
      );
    }
    state = result.state;
    if (options.recordEvents) events.push(...result.events);
    for (const hand of state.hands) maxHandSize = Math.max(maxHandSize, hand.length);
  };

  // 開始時の受付:張れるCPUは全員張る
  for (const player of PLAYER_IDS) {
    const action = toAction(decide(getPlayerView(state, player), rng), player);
    if (action) apply(action);
  }
  apply({ type: 'endStartWindow' });

  while (state.phase !== 'finished') {
    if (++steps > maxSteps) throw new Error(`シード ${seed}: ${maxSteps} 回動いても終わらない`);
    const current = state.currentPlayer;

    if (state.phase === 'awaitAction' || state.phase === 'afterDraw') {
      const action = toAction(decide(getPlayerView(state, current), rng), current);
      if (!action) throw new Error(`シード ${seed}: 手番の ${current} 番が何もしようとしない`);
      apply(action);
      continue;
    }

    // ④:プレイした本人は張る。他のCPUはドボンできるなら宣言する。宣言があれば判定、なければ次のターンへ
    const own = toAction(decide(getPlayerView(state, current), rng), current);
    if (own) apply(own);
    if (state.dobonWindowOpen) {
      for (let p = nextPlayer(current); p !== current; p = nextPlayer(p)) {
        const action = toAction(decide(getPlayerView(state, p), rng), p);
        if (action) apply(action);
      }
    }
    apply(state.declarations.length > 0 ? { type: 'resolve' } : { type: 'endTurn' });
  }

  return {
    seed,
    result: state.result as GameResult,
    turns: state.turnCount,
    maxHandSize,
    steps,
    events,
    finalState: state,
  };
}

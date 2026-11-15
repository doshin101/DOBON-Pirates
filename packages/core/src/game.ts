import { createDeck, handTotal, isPlayable, sameCard } from './cards';
import {
  checkArm,
  checkDobon,
  checkDraw,
  checkPass,
  checkPlay,
} from './checks';
import { shuffle, type Rng } from './rng';
import {
  ARM_MAX_TOTAL,
  PLAYER_COUNT,
  START_HAND_SIZE,
  nextPlayer,
  setQuad,
  type Action,
  type ActionErrorCode,
  type ApplyResult,
  type Card,
  type GameEvent,
  type GameResult,
  type GameState,
  type PlayerId,
  type Quad,
} from './types';

/**
 * ゲームを始める(配る)。
 * 親を決めて、シャッフルし、親から時計回りに3枚ずつ配り、山札の一番上を最初の場札にする。
 * 乱数は外から渡す(同じシードの乱数なら、同じ配りになる)。
 */
export function createGame(rng: Rng): { state: GameState; events: GameEvent[] } {
  const deck = shuffle(createDeck(), rng);
  const startingPlayer = rng.nextInt(PLAYER_COUNT) as PlayerId;

  const dealt: Card[][] = [[], [], [], []];
  let position = 0;
  for (let k = 0; k < PLAYER_COUNT; k++) {
    const player = (startingPlayer + k) % PLAYER_COUNT;
    dealt[player] = deck.slice(position, position + START_HAND_SIZE);
    position += START_HAND_SIZE;
  }
  const topCard = deck[position] as Card;
  position += 1;

  const state: GameState = {
    stock: deck.slice(position),
    hands: dealt as unknown as Quad<readonly Card[]>,
    discard: [topCard],
    topCard,
    topCardPlayedBy: null,
    startingPlayer,
    currentPlayer: startingPlayer,
    phase: 'startWindow',
    armed: [false, false, false, false],
    provisionalArm: [false, false, false, false],
    armedAtTurnStart: false,
    dobonWindowOpen: false,
    declarations: [],
    turnCount: 0,
    result: null,
  };
  return { state, events: [{ type: 'gameStarted', startingPlayer, topCard }] };
}

/**
 * 今の状態 + 操作 → 新しい状態 + 起きたこと。
 * 元の状態は書き換えない。受け付けられない操作は、状態をそのままにして理由を返す。
 */
export function applyAction(state: GameState, action: Action): ApplyResult {
  switch (action.type) {
    case 'arm':
      return applyArm(state, action.player);
    case 'play':
      return applyPlay(state, action.player, action.card);
    case 'draw':
      return applyDraw(state, action.player);
    case 'pass':
      return applyPass(state, action.player);
    case 'dobon':
      return applyDobon(state, action.player);
    case 'endStartWindow':
      return applyEndStartWindow(state);
    case 'endTurn':
      return applyEndTurn(state);
    case 'resolve':
      return applyResolve(state);
  }
}

// ---- 結果の作り方 ----

function fail(state: GameState, error: ActionErrorCode): ApplyResult {
  return { ok: false, state, error };
}

function succeed(state: GameState, events: readonly GameEvent[]): ApplyResult {
  return { ok: true, state, events };
}

function removeCard(hand: readonly Card[], card: Card): Card[] {
  const index = hand.findIndex((c) => sameCard(c, card));
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

/** ゲームを終わらせる */
function finish(state: GameState, result: GameResult, events: GameEvent[]): GameState {
  events.push({ type: 'gameEnded', result });
  return { ...state, phase: 'finished', dobonWindowOpen: false, result };
}

/** ドボン受付を閉じる(次のプレイヤーの最初の操作が実行されたとき) */
function closeWindow(state: GameState, events: GameEvent[]): GameState {
  if (!state.dobonWindowOpen) return state;
  events.push({ type: 'dobonWindowClosed' });
  return { ...state, dobonWindowOpen: false };
}

/**
 * 操作完了(プレイまたはパス)の時点の、張りの決着(M-3)。
 * - 仮押しがあれば、合計13以下で確定、14以上で失敗
 * - 張っていて、合計14以上なら、自動解除
 */
function completeAction(state: GameState, player: PlayerId, events: GameEvent[]): GameState {
  const total = handTotal(state.hands[player]);
  if (state.provisionalArm[player]) {
    const provisionalArm = setQuad(state.provisionalArm, player, false);
    if (total <= ARM_MAX_TOTAL) {
      events.push({ type: 'armed', player, source: 'provisional' });
      return { ...state, provisionalArm, armed: setQuad(state.armed, player, true) };
    }
    events.push({ type: 'armFailed', player, handTotal: total });
    return { ...state, provisionalArm };
  }
  if (state.armed[player] && total > ARM_MAX_TOTAL) {
    events.push({ type: 'disarmed', player, handTotal: total });
    return { ...state, armed: setQuad(state.armed, player, false) };
  }
  return state;
}

/**
 * ドボン・チョンボの判定(M-4・M-5)。
 * 有効なドボン(張っていて、合計 = 場札の数字)があれば、プレイした人から時計回りで
 * 次のターンに近い人が勝者、プレイした人が敗者。なければ、宣言した全員がチョンボで敗者。
 */
function judge(state: GameState): GameResult | null {
  const playedBy = state.topCardPlayedBy;
  if (playedBy === null || state.declarations.length === 0) return null;
  const valid = state.declarations.filter(
    (p) => state.armed[p] && handTotal(state.hands[p]) === state.topCard.rank,
  );
  if (valid.length > 0) {
    const distance = (p: PlayerId): number => (p - playedBy + PLAYER_COUNT) % PLAYER_COUNT;
    const winner = valid.reduce((best, p) => (distance(p) < distance(best) ? p : best));
    return { type: 'dobon', winner, loser: playedBy };
  }
  return { type: 'foul', losers: [...state.declarations] };
}

// ---- 操作ごとの処理 ----

function applyArm(state: GameState, player: PlayerId): ApplyResult {
  const check = checkArm(state, player);
  if (!check.ok) return fail(state, check.reason);

  if (state.phase === 'startWindow') {
    // 初張り:押した時点の合計で確定
    return succeed({ ...state, armed: setQuad(state.armed, player, true) }, [
      { type: 'armed', player, source: 'first' },
    ]);
  }
  if (state.phase === 'accept') {
    // ④:押した時点の合計で確定
    return succeed({ ...state, armed: setQuad(state.armed, player, true) }, [
      { type: 'armed', player, source: 'immediate' },
    ]);
  }
  // ②③:仮押し(確定は操作完了の時点)
  return succeed({ ...state, provisionalArm: setQuad(state.provisionalArm, player, true) }, [
    { type: 'armPressed', player },
  ]);
}

function applyPlay(state: GameState, player: PlayerId, card: Card): ApplyResult {
  const check = checkPlay(state, player);
  if (!check.ok) return fail(state, check.reason);
  const hand = state.hands[player];
  if (!hand.some((c) => sameCard(c, card))) return fail(state, 'cardNotInHand');
  if (!isPlayable(card, state.topCard)) return fail(state, 'cardNotPlayable');

  const events: GameEvent[] = [];
  // 前のカードの受付は、この最初の操作で閉じる
  let next = closeWindow(state, events);
  next = {
    ...next,
    hands: setQuad(next.hands, player, removeCard(hand, card)),
    discard: [...next.discard, card],
    topCard: card,
    topCardPlayedBy: player,
    phase: 'accept',
    // 新しい場札の受付が始まる(場札1枚につき1回)
    dobonWindowOpen: true,
    declarations: [],
  };
  events.push({ type: 'played', player, card });
  next = completeAction(next, player, events);
  events.push({ type: 'dobonWindowOpened', card, playedBy: player });
  return succeed(next, events);
}

function applyDraw(state: GameState, player: PlayerId): ApplyResult {
  const check = checkDraw(state, player);
  if (!check.ok) return fail(state, check.reason);

  const events: GameEvent[] = [];

  // 山札が0枚:ドローが必要なのにできない。先に判定し、成立しなければ引き分け(M-6)
  if (state.stock.length === 0) {
    const resolved = judge(state);
    if (resolved) {
      return succeed(finish(closeWindow(state, events), resolved, events), events);
    }
    return succeed(finish(closeWindow(state, events), { type: 'noContest' }, events), events);
  }

  const drawn = state.stock[0] as Card;
  let next = closeWindow(state, events);
  next = {
    ...next,
    stock: next.stock.slice(1),
    hands: setQuad(next.hands, player, [...next.hands[player], drawn]),
    phase: 'afterDraw',
  };
  events.push({ type: 'drew', player, card: drawn });
  return succeed(next, events);
}

function applyPass(state: GameState, player: PlayerId): ApplyResult {
  const check = checkPass(state, player);
  if (!check.ok) return fail(state, check.reason);

  const events: GameEvent[] = [{ type: 'passed', player }];
  // パスでは場札が変わらないので、受付は始まらない(ドロー時に閉じ済み)
  let next: GameState = { ...state, phase: 'accept' };
  next = completeAction(next, player, events);
  return succeed(next, events);
}

function applyDobon(state: GameState, player: PlayerId): ApplyResult {
  const check = checkDobon(state, player);
  if (!check.ok) return fail(state, check.reason);

  // 受付の時間外:操作はできるが無効(ノーカウント。チョンボにもならない)
  if (!state.dobonWindowOpen) return succeed(state, [{ type: 'dobonVoid', player }]);

  return succeed({ ...state, declarations: [...state.declarations, player] }, [
    { type: 'dobonDeclared', player },
  ]);
}

function applyEndStartWindow(state: GameState): ApplyResult {
  if (state.phase !== 'startWindow') return fail(state, 'wrongPhase');
  const player = state.currentPlayer;
  return succeed(
    {
      ...state,
      phase: 'awaitAction',
      armedAtTurnStart: state.armed[player],
      turnCount: 1,
    },
    [{ type: 'startWindowEnded' }, { type: 'turnStarted', player }],
  );
}

function applyEndTurn(state: GameState): ApplyResult {
  if (state.phase !== 'accept') return fail(state, 'wrongPhase');
  const events: GameEvent[] = [];
  const ended = state.currentPlayer;
  // 継続:張った状態でターンを始め、ターンの終了でも張っている
  if (state.armedAtTurnStart && state.armed[ended]) {
    events.push({ type: 'stillArmed', player: ended });
  }
  const player = nextPlayer(ended);
  events.push({ type: 'turnStarted', player });
  return succeed(
    {
      ...state,
      currentPlayer: player,
      phase: 'awaitAction',
      armedAtTurnStart: state.armed[player],
      turnCount: state.turnCount + 1,
    },
    events,
  );
}

function applyResolve(state: GameState): ApplyResult {
  if (state.phase === 'finished') return fail(state, 'gameFinished');
  const result = judge(state);
  if (!result) return fail(state, 'nothingToResolve');
  const events: GameEvent[] = [];
  return succeed(finish(closeWindow(state, events), result, events), events);
}

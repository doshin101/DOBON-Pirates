import { describe, expect, it } from 'vitest';
import type { GameState } from './types';
import { c, errorOf, hand, makeState, run } from './test-helpers';

/**
 * 場札 H9 を 0番がプレイした直後(④・受付中)。
 * 手札の合計が9(C4+C5)の人は、ドボンできる。合計が6(C4+C2)の人は、合わない。
 */
function windowAfterPlayBy0(overrides: Partial<GameState> = {}): GameState {
  return makeState({
    phase: 'accept',
    currentPlayer: 0,
    topCardPlayedBy: 0,
    dobonWindowOpen: true,
    hands: [hand('D3'), hand('C4', 'C5'), hand('C4', 'C5'), hand('C4', 'C5')],
    armed: [false, true, true, true],
    ...overrides,
  });
}

describe('T-09 張っていない人は、ドボンできない', () => {
  it('操作自体を受け付けない', () => {
    const state = windowAfterPlayBy0({ armed: [false, true, false, true] });
    expect(errorOf(state, { type: 'dobon', player: 2 })).toBe('notArmed');
  });
});

describe('T-10 最初の場札・自分がプレイしたカードには、ドボンできない', () => {
  it('最初の場札(開始時の受付中)は、受け付けない', () => {
    const state = makeState({
      phase: 'startWindow',
      topCardPlayedBy: null,
      armed: [false, true, false, false],
    });
    expect(errorOf(state, { type: 'dobon', player: 1 })).toBe('startingTopCard');
  });
  it('最初の場札は、ターンが始まっても対象外のまま', () => {
    const state = makeState({ topCardPlayedBy: null, armed: [false, true, false, false] });
    expect(errorOf(state, { type: 'dobon', player: 1 })).toBe('startingTopCard');
  });
  it('自分がプレイしたカードは、受け付けない', () => {
    const state = windowAfterPlayBy0({
      armed: [true, true, true, true],
      hands: [hand('C4', 'C5'), hand('C4', 'C5'), hand('C4', 'C5'), hand('C4', 'C5')],
    });
    expect(errorOf(state, { type: 'dobon', player: 0 })).toBe('ownCard');
  });
});

describe('T-11 受付の時間外のドボンは、無効(チョンボにならない)', () => {
  it('次のプレイヤーが最初の操作(ドロー)をしたあとは、無効', () => {
    const state = windowAfterPlayBy0({
      phase: 'awaitAction',
      currentPlayer: 1,
      armed: [false, false, true, false],
      hands: [hand('D3'), hand('D3', 'C2'), hand('C4', 'C5'), hand('C4', 'C5')],
    });
    const { state: afterDraw } = run(state, { type: 'draw', player: 1 });
    expect(afterDraw.dobonWindowOpen).toBe(false);
    const { state: next, events } = run(afterDraw, { type: 'dobon', player: 2 });
    expect(events).toEqual([{ type: 'dobonVoid', player: 2 }]);
    expect(next.declarations).toEqual([]);
    expect(next.result).toBeNull();
    expect(next.phase).not.toBe('finished'); // ゲームは続く
  });
  it('受付が始まっていない場札(合計が合わない人の宣言)も、無効でチョンボにならない', () => {
    const state = makeState({
      topCardPlayedBy: 0,
      armed: [false, true, false, false],
      hands: [hand('D3'), hand('C4', 'C2'), hand('C4'), hand('C4')], // 合計が合わない人
    });
    const { state: next, events } = run(state, { type: 'dobon', player: 1 });
    expect(events).toEqual([{ type: 'dobonVoid', player: 1 }]);
    expect(next.result).toBeNull();
  });
});

describe('T-12 張っていて合計が一致 → ドボン成立', () => {
  it('勝者はドボンした人、敗者はそのカードをプレイした人', () => {
    const state = windowAfterPlayBy0({ armed: [false, true, false, false] });
    const { state: declared, events } = run(state, { type: 'dobon', player: 1 });
    expect(events).toEqual([{ type: 'dobonDeclared', player: 1 }]);
    expect(declared.result).toBeNull(); // 判定は猶予のあと
    const { state: done, events: e2 } = run(declared, { type: 'resolve' });
    expect(done.result).toEqual({ type: 'dobon', winner: 1, loser: 0 });
    expect(done.phase).toBe('finished');
    expect(e2.at(-1)).toEqual({ type: 'gameEnded', result: { type: 'dobon', winner: 1, loser: 0 } });
  });
  it('宣言がないのに判定しようとしても、何も起きない', () => {
    expect(errorOf(windowAfterPlayBy0(), { type: 'resolve' })).toBe('nothingToResolve');
  });
});

describe('T-13 複数人のドボン → プレイした人から時計回りで近い人が勝者', () => {
  it('0番がプレイ → 1番が勝者(宣言の順に関係なく)', () => {
    const { state } = run(
      windowAfterPlayBy0(),
      { type: 'dobon', player: 3 },
      { type: 'dobon', player: 2 },
      { type: 'dobon', player: 1 },
      { type: 'resolve' },
    );
    expect(state.result).toEqual({ type: 'dobon', winner: 1, loser: 0 });
  });
  it('2番がプレイ → 3番が勝者(0番・1番より近い)', () => {
    const base = windowAfterPlayBy0({
      currentPlayer: 2,
      topCardPlayedBy: 2,
      armed: [true, true, false, true],
      hands: [hand('C4', 'C5'), hand('C4', 'C5'), hand('D3'), hand('C4', 'C5')],
    });
    const { state } = run(
      base,
      { type: 'dobon', player: 0 },
      { type: 'dobon', player: 1 },
      { type: 'dobon', player: 3 },
      { type: 'resolve' },
    );
    expect(state.result).toEqual({ type: 'dobon', winner: 3, loser: 2 });
  });
  it('猶予の間の宣言も、同じ判定に含まれる', () => {
    const { state } = run(
      windowAfterPlayBy0(),
      { type: 'dobon', player: 3 },
      { type: 'dobon', player: 1 }, // 猶予の間に宣言された分
      { type: 'resolve' },
    );
    expect(state.result).toEqual({ type: 'dobon', winner: 1, loser: 0 });
  });
  it('1回の受付で、宣言は1人1回まで', () => {
    const { state } = run(windowAfterPlayBy0(), { type: 'dobon', player: 1 });
    expect(errorOf(state, { type: 'dobon', player: 1 })).toBe('alreadyDeclared');
  });
});

describe('T-14 ドボンとチョンボが重なったら、ドボンが優先', () => {
  it('チョンボが先に宣言されても、ドボンが勝つ(チョンボは取らない)', () => {
    const state = windowAfterPlayBy0({
      hands: [hand('D3'), hand('C4', 'C5'), hand('C4', 'C2'), hand('C4', 'C5')], // 2番は合計6でチョンボ
    });
    const { state: done } = run(
      state,
      { type: 'dobon', player: 2 }, // チョンボ
      { type: 'dobon', player: 1 }, // ドボン
      { type: 'resolve' },
    );
    expect(done.result).toEqual({ type: 'dobon', winner: 1, loser: 0 });
  });
});

describe('T-15 複数のチョンボ → 全員が敗者', () => {
  it('合計が合わないまま宣言した全員が敗者(勝者なし)', () => {
    const state = windowAfterPlayBy0({
      hands: [hand('D3'), hand('C4', 'C2'), hand('C4', 'C1'), hand('C4', 'C5')],
    });
    const { state: done } = run(
      state,
      { type: 'dobon', player: 2 },
      { type: 'dobon', player: 1 },
      { type: 'resolve' },
    );
    expect(done.result?.type).toBe('foul');
    if (done.result?.type === 'foul') expect([...done.result.losers].sort()).toEqual([1, 2]);
  });
  it('チョンボ1人だけでも、その人が敗者', () => {
    const state = windowAfterPlayBy0({
      hands: [hand('D3'), hand('C4', 'C2'), hand('C4', 'C5'), hand('C4', 'C5')],
    });
    const { state: done } = run(state, { type: 'dobon', player: 1 }, { type: 'resolve' });
    expect(done.result).toEqual({ type: 'foul', losers: [1] });
  });
  it('合計が合っていない宣言も、受付中なら受け付ける(チョンボの可能性を残す)', () => {
    const state = windowAfterPlayBy0({
      hands: [hand('D3'), hand('C4', 'C2'), hand('C4', 'C5'), hand('C4', 'C5')],
    });
    expect(errorOf(state, { type: 'dobon', player: 1 })).toBe('ok');
  });
});

describe('T-16 受付は、次のプレイヤーの最初の操作の実行で閉じる', () => {
  const nextTurn = windowAfterPlayBy0({
    phase: 'awaitAction',
    currentPlayer: 1,
    armed: [false, false, true, true],
    hands: [hand('D3'), hand('H5', 'D3', 'C2'), hand('C4', 'C5'), hand('C4', 'C5')],
  });

  it('張る(仮押し)をしただけでは、閉じない', () => {
    const { state } = run(nextTurn, { type: 'arm', player: 1 });
    expect(state.dobonWindowOpen).toBe(true);
    expect(errorOf(state, { type: 'dobon', player: 2 })).toBe('ok'); // まだ宣言できる
    const { state: declared, events } = run(state, { type: 'dobon', player: 2 });
    expect(events).toEqual([{ type: 'dobonDeclared', player: 2 }]);
    expect(declared.declarations).toEqual([2]);
  });

  it('プレイを実行すると閉じて、新しい場札の受付が始まる', () => {
    const { state, events } = run(nextTurn, { type: 'play', player: 1, card: c('H5') });
    expect(events.map((e) => e.type)).toEqual(['dobonWindowClosed', 'played', 'dobonWindowOpened']);
    expect(state.dobonWindowOpen).toBe(true); // 新しい場札(H5)の受付
    expect(state.topCardPlayedBy).toBe(1);
  });

  it('ドローを実行すると閉じる(新しい受付は始まらない)', () => {
    const state = windowAfterPlayBy0({
      phase: 'awaitAction',
      currentPlayer: 1,
      hands: [hand('D3'), hand('D3', 'C2'), hand('C4', 'C5'), hand('C4', 'C5')],
    });
    const { state: next, events } = run(state, { type: 'draw', player: 1 });
    expect(next.dobonWindowOpen).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['dobonWindowClosed', 'drew']);
  });

  it('猶予の間(宣言があるとき)は、次のプレイヤーの操作が止まる。判定が済めばゲームが終わる', () => {
    const noPlayable = windowAfterPlayBy0({
      phase: 'awaitAction',
      currentPlayer: 1,
      armed: [false, false, true, true],
      hands: [hand('D3'), hand('D3', 'C2'), hand('C4', 'C5'), hand('C4', 'C5')],
    });
    const { state } = run(noPlayable, { type: 'dobon', player: 2 });
    expect(errorOf(state, { type: 'draw', player: 1 })).toBe('resolutionPending');
    const withPlayable = run(nextTurn, { type: 'dobon', player: 2 }).state;
    expect(errorOf(withPlayable, { type: 'play', player: 1, card: c('H5') })).toBe('resolutionPending');
    const { state: done } = run(state, { type: 'resolve' });
    expect(done.phase).toBe('finished');
  });

  it('④の間に宣言があっても、ターンの終了(endTurn)はできる。操作は判定まで止まる', () => {
    const { state } = run(windowAfterPlayBy0(), { type: 'dobon', player: 1 }, { type: 'endTurn' });
    expect(state.phase).toBe('awaitAction');
    expect(state.declarations).toEqual([1]);
    expect(errorOf(state, { type: 'draw', player: 1 })).toBe('resolutionPending');
  });
});

describe('T-17 パスでは受付が始まらない', () => {
  it('パスのあと、場札はそのままで、受付は閉じたまま(ドボンは無効)', () => {
    const state = makeState({
      topCardPlayedBy: 3,
      armed: [false, true, false, false],
      hands: [hand('D3', 'C2'), hand('C4', 'C5'), hand('C4'), hand('C4')],
    });
    const { state: passed, events } = run(
      state,
      { type: 'draw', player: 0 },
      { type: 'pass', player: 0 },
    );
    expect(events.map((e) => e.type)).not.toContain('dobonWindowOpened');
    expect(passed.dobonWindowOpen).toBe(false);
    expect(passed.topCardPlayedBy).toBe(3);
    const { events: e2, state: after } = run(passed, { type: 'dobon', player: 1 });
    expect(e2).toEqual([{ type: 'dobonVoid', player: 1 }]);
    expect(after.result).toBeNull();
  });
});

describe('T-18 ドローして合計が場札と一致しても、ドボンできない', () => {
  it('ドローしたあとの宣言は無効(引きドボンはない)', () => {
    // 張っている0番は、合計が6。SK(13)... ではなく、H3 を引いて合計9 = 場札H9 になる
    const state = makeState({
      topCardPlayedBy: 3,
      hands: [hand('D4', 'C2'), hand('C4'), hand('C4'), hand('C4')],
      stock: [c('D3')],
      armed: [true, false, false, false],
      dobonWindowOpen: true, // 3番のプレイの受付中(0番が次のプレイヤー)
    });
    const { state: drawn } = run(state, { type: 'draw', player: 0 });
    expect(drawn.hands[0].reduce((s, x) => s + x.rank, 0)).toBe(9);
    expect(drawn.dobonWindowOpen).toBe(false);
    const { state: after, events } = run(drawn, { type: 'dobon', player: 0 });
    expect(events).toEqual([{ type: 'dobonVoid', player: 0 }]);
    expect(after.result).toBeNull();
  });
});

describe('T-19 次のプレイヤーが②で仮押ししても、受付中のカードにはドボンできない', () => {
  it('仮押しは確定ではないので、張っていない扱い', () => {
    const state = windowAfterPlayBy0({
      phase: 'awaitAction',
      currentPlayer: 1,
      armed: [false, false, false, false],
    });
    const { state: pressed } = run(state, { type: 'arm', player: 1 });
    expect(pressed.armed[1]).toBe(false);
    expect(errorOf(pressed, { type: 'dobon', player: 1 })).toBe('notArmed');
  });
  it('受付中にプレイした本人が④で張っても、他の人のドボンには関係しない(自分のカードは対象外)', () => {
    const state = windowAfterPlayBy0({ armed: [false, false, false, false] });
    const { state: armed } = run(state, { type: 'arm', player: 0 });
    expect(errorOf(armed, { type: 'dobon', player: 0 })).toBe('ownCard');
  });
});

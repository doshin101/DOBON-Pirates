import { describe, expect, it } from 'vitest';
import type { GameState } from './types';
import { c, errorOf, hand, makeState, run } from './test-helpers';

describe('T-20 山札が0枚でドローが必要 → 先に判定し、成立しなければ引き分け', () => {
  // 山札が0枚。1番の手番で、1番は出せるカードがない。場札は0番がプレイした(受付中)
  const noStock: Partial<GameState> = {
    stock: [],
    hands: [hand('D3'), hand('D3', 'C2'), hand('C4', 'C5'), hand('C4', 'C5')],
    currentPlayer: 1,
    topCardPlayedBy: 0,
    dobonWindowOpen: true,
  };

  it('宣言がなければ、引き分け(出せるカードがなくドローが必要)', () => {
    const state = makeState(noStock);
    const { state: done, events } = run(state, { type: 'draw', player: 1 });
    expect(done.result).toEqual({ type: 'noContest' });
    expect(done.phase).toBe('finished');
    expect(events.map((e) => e.type)).toEqual(['dobonWindowClosed', 'gameEnded']);
  });

  it('受付中・猶予中にドボンが成立していれば、そちらが結果になる', () => {
    const state = makeState({
      ...noStock,
      armed: [false, false, true, false],
      declarations: [2],
    });
    const { state: done } = run(state, { type: 'draw', player: 1 });
    expect(done.result).toEqual({ type: 'dobon', winner: 2, loser: 0 });
  });

  it('受付中・猶予中にチョンボがあれば、チョンボが結果になる', () => {
    const state = makeState({
      ...noStock,
      hands: [hand('D3'), hand('D3', 'C2'), hand('C4', 'C2'), hand('C4', 'C5')],
      armed: [false, false, true, false],
      declarations: [2],
    });
    const { state: done } = run(state, { type: 'draw', player: 1 });
    expect(done.result).toEqual({ type: 'foul', losers: [2] });
  });

  it('出せるカードがあるなら、山札が0枚でもドローは選べない(引き分けにならない)', () => {
    const state = makeState({
      ...noStock,
      hands: [hand('D3'), hand('H5', 'D3'), hand('C4', 'C5'), hand('C4', 'C5')],
    });
    expect(errorOf(state, { type: 'draw', player: 1 })).toBe('hasPlayableCard');
  });

  it('山札が0枚でも、プレイとパスは普通にできる', () => {
    const state = makeState({
      stock: [],
      hands: [hand('H5', 'D3'), hand('C4'), hand('C4'), hand('C4')],
    });
    expect(errorOf(state, { type: 'play', player: 0, card: c('H5') })).toBe('ok');
  });
});

describe('T-21 手札1枚・山札0枚 → その1枚が出せるカードでも引き分け', () => {
  it('手札1枚は先にドローしなければならないので、引き分け', () => {
    const state = makeState({
      stock: [],
      hands: [hand('H5'), hand('C4'), hand('C4'), hand('C4')], // H5 は場札H9に出せる
    });
    expect(errorOf(state, { type: 'play', player: 0, card: c('H5') })).toBe('mustDrawFirst');
    const { state: done } = run(state, { type: 'draw', player: 0 });
    expect(done.result).toEqual({ type: 'noContest' });
  });
});

import { describe, expect, it } from 'vitest';
import { createDeck, isPlayable, playableCards } from './cards';
import { createGame } from './game';
import { createRng } from './rng';
import { getPlayerView } from './view';
import { c, hand, makeState } from './test-helpers';

const key = (card: { suit: string; rank: number }): string => `${card.suit}${card.rank}`;

describe('T-01 配り終わったとき', () => {
  it.each([1, 2, 3, 42, 12345])('シード %i:52枚そろい、各3枚、場札1枚、山札39枚', (seed) => {
    const { state } = createGame(createRng(seed));
    const all = [...state.stock, ...state.hands.flat(), state.topCard];
    expect(all).toHaveLength(52);
    expect(new Set(all.map(key)).size).toBe(52);
    expect(new Set(createDeck().map(key))).toEqual(new Set(all.map(key)));
    for (const h of state.hands) expect(h).toHaveLength(3);
    expect(state.stock).toHaveLength(39);
    expect(state.discard).toEqual([state.topCard]);
  });

  it('最初の場札は、誰もプレイしていない。開始時の受付から始まる', () => {
    const { state, events } = createGame(createRng(7));
    expect(state.topCardPlayedBy).toBeNull();
    expect(state.phase).toBe('startWindow');
    expect(state.dobonWindowOpen).toBe(false);
    expect(state.currentPlayer).toBe(state.startingPlayer);
    expect(events[0]).toMatchObject({ type: 'gameStarted', startingPlayer: state.startingPlayer });
  });

  it('同じシードなら同じ配り。違うシードなら違う配り', () => {
    expect(createGame(createRng(5)).state).toEqual(createGame(createRng(5)).state);
    expect(createGame(createRng(5)).state).not.toEqual(createGame(createRng(6)).state);
  });

  it('親は4人のどれかで、シードによってばらける', () => {
    const starters = new Set<number>();
    for (let seed = 0; seed < 50; seed++) starters.add(createGame(createRng(seed)).state.startingPlayer);
    expect(starters.size).toBe(4);
  });
});

describe('T-02 出せるカード', () => {
  const top = c('H9');
  it('同じ数字か同じマークだけ', () => {
    expect(isPlayable(c('H2'), top)).toBe(true); // 同じマーク
    expect(isPlayable(c('D9'), top)).toBe(true); // 同じ数字
    expect(isPlayable(c('S9'), top)).toBe(true);
    expect(isPlayable(c('D2'), top)).toBe(false);
    expect(isPlayable(c('CK'), top)).toBe(false);
  });

  it('手札の中から、出せるカードだけを選ぶ', () => {
    expect(playableCards(hand('H2', 'D2', 'S9', 'CK'), top)).toEqual(hand('H2', 'S9'));
    expect(playableCards(hand('D2', 'CK'), top)).toEqual([]);
  });
});

describe('見える情報(M-8)', () => {
  it('PlayerView は、他の人の手札の中身・山札の順番・他の人の宣言を含まない', () => {
    const state = makeState({
      hands: [hand('H1', 'H2'), hand('D1'), hand('D2', 'D3', 'D4'), hand('S1')],
      armed: [false, true, false, false],
      declarations: [1],
      dobonWindowOpen: true,
    });
    const view = getPlayerView(state, 0);
    expect(view.hand).toEqual(hand('H1', 'H2'));
    expect(view.handCounts).toEqual([2, 1, 3, 1]);
    expect(view.armed).toEqual([false, true, false, false]);
    expect(view.declared).toBe(false); // 1番が宣言したことは、0番には見えない
    expect(getPlayerView(state, 1).declared).toBe(true); // 本人には見える
    expect(JSON.stringify(view)).not.toContain('"stock"');
    expect(view.stockCount).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import {
  createRng,
  getPlayerView,
  type Card,
  type GameState,
  type PlayerId,
  type Rank,
  type Suit,
} from '@dobon/core';
import { decide } from './decide';

const c = (code: string): Card => {
  const named: Record<string, number> = { A: 1, J: 11, Q: 12, K: 13 };
  return { suit: code[0] as Suit, rank: (named[code.slice(1)] ?? Number(code.slice(1))) as Rank };
};
const hand = (...codes: string[]): Card[] => codes.map(c);

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    stock: [c('SK'), c('SQ')],
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
    ...overrides,
  };
}

const decideFor = (s: GameState, player: PlayerId, seed = 1) =>
  decide(getPlayerView(s, player), createRng(seed));

describe('CPUの張り', () => {
  it('開始時:合計13以下なら、必ず初張りする', () => {
    const s = state({ phase: 'startWindow', topCardPlayedBy: null });
    expect(decideFor(s, 1)).toEqual({ kind: 'arm' });
  });
  it('開始時:合計14以上なら、張らない', () => {
    const s = state({
      phase: 'startWindow',
      topCardPlayedBy: null,
      hands: [hand('C4'), hand('D8', 'C9'), hand('C4'), hand('C4')],
    });
    expect(decideFor(s, 1)).toEqual({ kind: 'none' });
  });
  it('開始時:すでに張っているなら、何もしない', () => {
    const s = state({ phase: 'startWindow', topCardPlayedBy: null, armed: [false, true, false, false] });
    expect(decideFor(s, 1)).toEqual({ kind: 'none' });
  });
  it('自分のターンの④:張っておらず合計13以下なら、張る', () => {
    expect(decideFor(state({ phase: 'accept' }), 0)).toEqual({ kind: 'arm' });
  });
  it('自分のターンの④:合計14以上なら、張らない', () => {
    const s = state({ phase: 'accept', hands: [hand('SK', 'S2'), hand('C4'), hand('C4'), hand('C4')] });
    expect(decideFor(s, 0)).toEqual({ kind: 'none' });
  });
  it('他の人のターンの④では、張らない', () => {
    expect(decideFor(state({ phase: 'accept', currentPlayer: 0 }), 1)).toEqual({ kind: 'none' });
  });
});

describe('CPUのドボン', () => {
  const open = (overrides: Partial<GameState> = {}) =>
    state({
      phase: 'accept',
      currentPlayer: 0,
      topCardPlayedBy: 0,
      dobonWindowOpen: true,
      armed: [false, true, false, false],
      ...overrides,
    });
  it('張っていて、合計が場札の数字と一致 → 必ずドボンする', () => {
    expect(decideFor(open(), 1)).toEqual({ kind: 'dobon' });
  });
  it('合計が一致していなければ、ドボンしない(チョンボしない)', () => {
    const s = open({ hands: [hand('D3'), hand('C4', 'C2'), hand('C4'), hand('C4')] });
    expect(decideFor(s, 1)).toEqual({ kind: 'none' });
  });
  it('張っていなければ、ドボンしない', () => {
    expect(decideFor(open({ armed: [false, false, false, false] }), 1)).toEqual({ kind: 'none' });
  });
  it('受付の時間外は、ドボンしない', () => {
    expect(decideFor(open({ dobonWindowOpen: false }), 1)).toEqual({ kind: 'none' });
  });
  it('自分がプレイしたカードと、最初の場札には、ドボンしない', () => {
    expect(decideFor(open({ topCardPlayedBy: 1, armed: [false, true, false, false] }), 1)).toEqual({
      kind: 'none',
    });
    expect(decideFor(open({ topCardPlayedBy: null }), 1)).toEqual({ kind: 'none' });
  });
  it('宣言ずみなら、もう一度宣言しない', () => {
    expect(decideFor(open({ declarations: [1] }), 1)).toEqual({ kind: 'none' });
  });
  it('次のプレイヤーの手番でも、ドボンを優先する', () => {
    const s = open({ phase: 'awaitAction', currentPlayer: 1 });
    expect(decideFor(s, 1)).toEqual({ kind: 'dobon' });
  });
});

describe('CPUの手番の操作', () => {
  it('出せるカードがあれば、その中から1枚プレイする', () => {
    const s = state({ hands: [hand('H5', 'S9', 'D3'), hand('C4'), hand('C4'), hand('C4')] });
    for (let seed = 1; seed <= 20; seed++) {
      const d = decideFor(s, 0, seed);
      expect(d.kind).toBe('play');
      if (d.kind === 'play') expect([c('H5'), c('S9')]).toContainEqual(d.card);
    }
  });
  it('出せるカードが複数あるとき、シードによって選ぶカードが変わる(ランダム)', () => {
    const s = state({ hands: [hand('H5', 'S9', 'D9', 'H1'), hand('C4'), hand('C4'), hand('C4')] });
    const chosen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const d = decideFor(s, 0, seed);
      if (d.kind === 'play') chosen.add(`${d.card.suit}${d.card.rank}`);
    }
    expect(chosen.size).toBeGreaterThan(1);
  });
  it('同じシードなら、同じカードを選ぶ', () => {
    const s = state({ hands: [hand('H5', 'S9', 'D9', 'H1'), hand('C4'), hand('C4'), hand('C4')] });
    expect(decideFor(s, 0, 7)).toEqual(decideFor(s, 0, 7));
  });
  it('出せるカードがなければ、ドロー', () => {
    const s = state({ hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')] });
    expect(decideFor(s, 0)).toEqual({ kind: 'draw' });
  });
  it('手札1枚なら、出せるカードでも、まずドロー', () => {
    const s = state({ hands: [hand('H5'), hand('C4'), hand('C4'), hand('C4')] });
    expect(decideFor(s, 0)).toEqual({ kind: 'draw' });
  });
  it('ドローのあと、出せなければパス。出せればプレイ', () => {
    const none = state({ phase: 'afterDraw', hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')] });
    expect(decideFor(none, 0)).toEqual({ kind: 'pass' });
    const some = state({ phase: 'afterDraw', hands: [hand('D3', 'H2'), hand('C4'), hand('C4'), hand('C4')] });
    expect(decideFor(some, 0)).toEqual({ kind: 'play', card: c('H2') });
  });
  it('自分の番でなければ、何もしない。ゲームが終わっていても何もしない', () => {
    expect(decideFor(state(), 1)).toEqual({ kind: 'none' });
    expect(decideFor(state({ phase: 'finished', result: { type: 'noContest' } }), 0)).toEqual({
      kind: 'none',
    });
  });
});

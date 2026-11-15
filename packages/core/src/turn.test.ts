import { describe, expect, it } from 'vitest';
import { getTurnOptions } from './checks';
import { c, errorOf, hand, makeState, run } from './test-helpers';

const reason = (check: { ok: boolean; reason?: string }): string =>
  check.ok ? 'ok' : (check.reason as string);

describe('T-03 手札2枚以上で出せるカードがあるときは、ドローできない', () => {
  const state = makeState({
    hands: [hand('H5', 'D3', 'C2'), hand('C4'), hand('C4'), hand('C4')],
  });
  it('ドローは受け付けない', () => {
    expect(errorOf(state, { type: 'draw', player: 0 })).toBe('hasPlayableCard');
  });
  it('プレイはできる', () => {
    expect(errorOf(state, { type: 'play', player: 0, card: c('H5') })).toBe('ok');
  });
});

describe('T-04 手札1枚のときは、プレイできず、先にドロー', () => {
  const state = makeState({ hands: [hand('H5'), hand('C4'), hand('C4'), hand('C4')] });
  it('出せるカードでも、プレイは受け付けない', () => {
    expect(errorOf(state, { type: 'play', player: 0, card: c('H5') })).toBe('mustDrawFirst');
  });
  it('ドローしたあとは、出せるカードをプレイできる', () => {
    const { state: drawn } = run(state, { type: 'draw', player: 0 });
    expect(drawn.phase).toBe('afterDraw');
    expect(drawn.hands[0]).toEqual(hand('H5', 'SK'));
    expect(errorOf(drawn, { type: 'play', player: 0, card: c('H5') })).toBe('ok');
  });
});

describe('T-05 パスはドローの後で、出せるカードがないときだけ', () => {
  it('ターンの開始時(ドローの前)は、パスできない', () => {
    const state = makeState({ hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')] });
    expect(errorOf(state, { type: 'pass', player: 0 })).toBe('drawFirst');
  });
  it('ドローの後、出せるカードがあるときは、パスできない', () => {
    const state = makeState({
      hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')],
      stock: [c('H13'), c('SQ')], // 引いたカードが出せる
    });
    const { state: drawn } = run(state, { type: 'draw', player: 0 });
    expect(errorOf(drawn, { type: 'pass', player: 0 })).toBe('hasPlayableCard');
  });
  it('ドローの後、出せるカードがないときは、パスできる(受付は始まらない)', () => {
    const state = makeState({ hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')] });
    const { state: passed, events } = run(
      state,
      { type: 'draw', player: 0 },
      { type: 'pass', player: 0 },
    );
    expect(passed.phase).toBe('accept');
    expect(passed.dobonWindowOpen).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['drew', 'passed']);
  });
  it('ドローは1回だけ', () => {
    const state = makeState({ hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')] });
    const { state: drawn } = run(state, { type: 'draw', player: 0 });
    expect(errorOf(drawn, { type: 'draw', player: 0 })).toBe('alreadyDrew');
  });
});

describe('操作の選択肢の一覧(spec 4-3 の表)', () => {
  const at = (phase: 'awaitAction' | 'afterDraw', h: string[]) =>
    getTurnOptions(
      makeState({ phase, hands: [hand(...h), hand('C4'), hand('C4'), hand('C4')] }),
      0,
    );

  it('② 手札2枚以上・出せるカードあり', () => {
    const o = at('awaitAction', ['H5', 'D3']);
    expect([reason(o.play), reason(o.draw), reason(o.pass)]).toEqual([
      'ok',
      'hasPlayableCard',
      'drawFirst',
    ]);
    expect(o.playableCards).toEqual(hand('H5'));
  });
  it('② 手札2枚以上・出せるカードなし', () => {
    const o = at('awaitAction', ['D3', 'C2']);
    expect([reason(o.play), reason(o.draw), reason(o.pass)]).toEqual([
      'noPlayableCard',
      'ok',
      'drawFirst',
    ]);
  });
  it('② 手札1枚', () => {
    const o = at('awaitAction', ['H5']);
    expect([reason(o.play), reason(o.draw), reason(o.pass)]).toEqual([
      'mustDrawFirst',
      'ok',
      'drawFirst',
    ]);
  });
  it('③ 出せるカードあり', () => {
    const o = at('afterDraw', ['H5', 'D3']);
    expect([reason(o.play), reason(o.draw), reason(o.pass)]).toEqual([
      'ok',
      'alreadyDrew',
      'hasPlayableCard',
    ]);
  });
  it('③ 出せるカードなし', () => {
    const o = at('afterDraw', ['D3', 'C2']);
    expect([reason(o.play), reason(o.draw), reason(o.pass)]).toEqual([
      'noPlayableCard',
      'alreadyDrew',
      'ok',
    ]);
  });
  it('自分の番でないときは、どれも押せない', () => {
    const state = makeState({ hands: [hand('H5', 'D3'), hand('H5', 'D3'), hand('C4'), hand('C4')] });
    const o = getTurnOptions(state, 1);
    expect([reason(o.play), reason(o.draw), reason(o.pass)]).toEqual([
      'notYourTurn',
      'notYourTurn',
      'notYourTurn',
    ]);
  });
});

describe('ターンの進み方', () => {
  it('プレイすると、場札が変わり、受付が始まり、④になる', () => {
    const state = makeState({ hands: [hand('H5', 'D3'), hand('C4'), hand('C4'), hand('C4')] });
    const { state: next, events } = run(state, { type: 'play', player: 0, card: c('H5') });
    expect(next.topCard).toEqual(c('H5'));
    expect(next.topCardPlayedBy).toBe(0);
    expect(next.discard).toHaveLength(2);
    expect(next.hands[0]).toEqual(hand('D3'));
    expect(next.phase).toBe('accept');
    expect(next.dobonWindowOpen).toBe(true);
    expect(events.map((e) => e.type)).toEqual(['played', 'dobonWindowOpened']);
  });
  it('持っていないカード・出せないカードは出せない', () => {
    const state = makeState({ hands: [hand('H5', 'D3'), hand('C4'), hand('C4'), hand('C4')] });
    expect(errorOf(state, { type: 'play', player: 0, card: c('HK') })).toBe('cardNotInHand');
    expect(errorOf(state, { type: 'play', player: 0, card: c('D3') })).toBe('cardNotPlayable');
  });
  it('他の人の番には、操作できない', () => {
    const state = makeState({ hands: [hand('H5', 'D3'), hand('H5', 'D3'), hand('C4'), hand('C4')] });
    expect(errorOf(state, { type: 'play', player: 1, card: c('H5') })).toBe('notYourTurn');
  });
  it('endTurn で次の人(時計回り)のターンになる。4番目の次は0番', () => {
    const state = makeState({ phase: 'accept', currentPlayer: 3 });
    const { state: next, events } = run(state, { type: 'endTurn' });
    expect(next.currentPlayer).toBe(0);
    expect(next.phase).toBe('awaitAction');
    expect(next.turnCount).toBe(2);
    expect(events).toEqual([{ type: 'turnStarted', player: 0 }]);
  });
  it('開始時の受付が終わると、親のターンが始まる', () => {
    const state = makeState({ phase: 'startWindow', startingPlayer: 2, currentPlayer: 2, turnCount: 0 });
    const { state: next } = run(state, { type: 'endStartWindow' });
    expect(next.phase).toBe('awaitAction');
    expect(next.currentPlayer).toBe(2);
    expect(next.turnCount).toBe(1);
  });
  it('終わったゲームには、操作できない', () => {
    const state = makeState({ phase: 'finished', result: { type: 'noContest' } });
    expect(errorOf(state, { type: 'draw', player: 0 })).toBe('gameFinished');
    expect(errorOf(state, { type: 'arm', player: 0 })).toBe('gameFinished');
  });
});

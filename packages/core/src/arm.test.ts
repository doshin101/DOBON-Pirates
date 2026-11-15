import { describe, expect, it } from 'vitest';
import { c, errorOf, hand, makeState, run } from './test-helpers';

describe('T-06 仮押し:操作完了の合計で、確定か失敗', () => {
  it('合計13以下で操作完了 → 張り確定', () => {
    const state = makeState({ hands: [hand('H5', 'D3', 'C2'), hand('C4'), hand('C4'), hand('C4')] });
    const { state: pressed, events: e1 } = run(state, { type: 'arm', player: 0 });
    expect(pressed.armed[0]).toBe(false); // まだ確定していない
    expect(pressed.provisionalArm[0]).toBe(true);
    expect(e1).toEqual([{ type: 'armPressed', player: 0 }]);

    const { state: done, events: e2 } = run(pressed, { type: 'play', player: 0, card: c('H5') });
    expect(done.armed[0]).toBe(true);
    expect(done.provisionalArm[0]).toBe(false);
    expect(e2).toContainEqual({ type: 'armed', player: 0, source: 'provisional' });
  });

  it('操作完了の合計が14以上 → 失敗', () => {
    const state = makeState({ hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')] });
    const { state: done, events } = run(
      state,
      { type: 'arm', player: 0 }, // 合計5で仮押し
      { type: 'draw', player: 0 }, // SK(13)を引いて合計18
      { type: 'pass', player: 0 },
    );
    expect(done.armed[0]).toBe(false);
    expect(done.provisionalArm[0]).toBe(false);
    expect(events).toContainEqual({ type: 'armFailed', player: 0, handTotal: 18 });
  });

  it('操作の途中で14以上でも、操作完了の合計が13以下なら確定する', () => {
    const state = makeState({
      hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')],
      stock: [c('H13')], // 引くと合計18だが、出せるカード(ハート)
    });
    const { state: done } = run(
      state,
      { type: 'arm', player: 0 },
      { type: 'draw', player: 0 },
      { type: 'play', player: 0, card: c('H13') },
    );
    expect(done.armed[0]).toBe(true);
  });

  it('押した時点の合計が14以上なら、仮押しできない', () => {
    const state = makeState({ hands: [hand('D8', 'C9'), hand('C4'), hand('C4'), hand('C4')] });
    expect(errorOf(state, { type: 'arm', player: 0 })).toBe('totalTooHigh');
  });

  it('自分のターン以外では、張れない。同じ人は2回押せない', () => {
    const state = makeState();
    expect(errorOf(state, { type: 'arm', player: 1 })).toBe('notYourTurn');
    const { state: pressed } = run(state, { type: 'arm', player: 0 });
    expect(errorOf(pressed, { type: 'arm', player: 0 })).toBe('alreadyArmed');
  });
});

describe('開始時の初張り', () => {
  const start = makeState({
    phase: 'startWindow',
    topCardPlayedBy: null,
    hands: [hand('D8', 'C9'), hand('C4', 'C5'), hand('C4'), hand('C4', 'C2', 'C1')],
  });
  it('全員が、押した時点の合計(13以下)で確定する', () => {
    const { state, events } = run(start, { type: 'arm', player: 1 }, { type: 'arm', player: 3 });
    expect(state.armed).toEqual([false, true, false, true]);
    expect(events[0]).toEqual({ type: 'armed', player: 1, source: 'first' });
  });
  it('合計14以上は張れない', () => {
    expect(errorOf(start, { type: 'arm', player: 0 })).toBe('totalTooHigh');
  });
});

describe('T-07 自動解除と、張り直し', () => {
  it('張っている人の操作完了の合計が14以上 → 自動解除', () => {
    const state = makeState({
      hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')],
      armed: [true, false, false, false],
    });
    const { state: done, events } = run(
      state,
      { type: 'draw', player: 0 }, // 引いても、操作完了まで張りは続く
      { type: 'pass', player: 0 },
    );
    expect(done.armed[0]).toBe(false);
    expect(events).toContainEqual({ type: 'disarmed', player: 0, handTotal: 18 });
  });

  it('解除のあと、合計が13以下に戻っても、自動では張り直されない', () => {
    // 解除された人が次のターンに出して、合計が13以下に戻った場面
    const state = makeState({
      hands: [hand('H13', 'D3', 'C2'), hand('C4'), hand('C4'), hand('C4')], // 合計18、張っていない
    });
    const { state: done, events } = run(state, { type: 'play', player: 0, card: c('H13') });
    expect(done.armed[0]).toBe(false);
    expect(events.map((e) => e.type)).not.toContain('armed');
  });

  it('操作の途中で14以上でも、完了の合計が13以下なら、解除されない', () => {
    const state = makeState({
      hands: [hand('D3', 'C2'), hand('C4'), hand('C4'), hand('C4')],
      stock: [c('H13')],
      armed: [true, false, false, false],
    });
    const { state: done } = run(
      state,
      { type: 'draw', player: 0 },
      { type: 'play', player: 0, card: c('H13') },
    );
    expect(done.armed[0]).toBe(true);
  });
});

describe('T-08 ④の張りは、押した時点の合計で決まる', () => {
  it('合計13以下なら、すぐ確定する', () => {
    const state = makeState({
      phase: 'accept',
      hands: [hand('H5', 'D3'), hand('C4'), hand('C4'), hand('C4')],
    });
    const { state: done, events } = run(state, { type: 'arm', player: 0 });
    expect(done.armed[0]).toBe(true);
    expect(events).toEqual([{ type: 'armed', player: 0, source: 'immediate' }]);
  });
  it('合計14以上なら、押せない', () => {
    const state = makeState({
      phase: 'accept',
      hands: [hand('SK', 'S2'), hand('C4'), hand('C4'), hand('C4')],
    });
    expect(errorOf(state, { type: 'arm', player: 0 })).toBe('totalTooHigh');
  });
  it('プレイした直後(④)に張れて、プレイした人がドボンされても張りは変わらない', () => {
    const state = makeState({ hands: [hand('H5', 'D3'), hand('C4'), hand('C4'), hand('C4')] });
    const { state: done } = run(
      state,
      { type: 'play', player: 0, card: c('H5') },
      { type: 'arm', player: 0 },
    );
    expect(done.armed[0]).toBe(true);
  });
});

describe('継続(stillArmed)', () => {
  it('張った状態でターンを始め、終了でも張っていたら、継続', () => {
    const state = makeState({
      phase: 'accept',
      armed: [true, false, false, false],
      armedAtTurnStart: true,
    });
    const { events } = run(state, { type: 'endTurn' });
    expect(events).toContainEqual({ type: 'stillArmed', player: 0 });
  });
  it('ターンの途中で張った人は、継続ではない', () => {
    const state = makeState({
      phase: 'accept',
      armed: [true, false, false, false],
      armedAtTurnStart: false,
    });
    const { events } = run(state, { type: 'endTurn' });
    expect(events.map((e) => e.type)).not.toContain('stillArmed');
  });
  it('ターンの途中で解除された人は、継続ではない', () => {
    const state = makeState({ phase: 'accept', armed: [false, false, false, false], armedAtTurnStart: true });
    const { events } = run(state, { type: 'endTurn' });
    expect(events.map((e) => e.type)).not.toContain('stillArmed');
  });
});

import { describe, expect, it } from 'vitest';
import type { Card, GameState, Rank, Suit } from '@dobon/core';
import { getHumanControls } from './controls';
import type { Snapshot, Stage } from './GameRunner';

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank });

function snapshot(overrides: Partial<GameState>, stage: Stage = 'action'): Snapshot {
  const state: GameState = {
    stock: [c('S', 13)],
    hands: [[c('H', 5), c('D', 3), c('C', 2)], [c('C', 4)], [c('C', 4)], [c('C', 4)]],
    discard: [c('H', 9)],
    topCard: c('H', 9),
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
  return { state, stage, log: [], toasts: [], countdown: null, seed: 1, speed: 1 };
}

describe('カードの状態(spec 4-4)', () => {
  const snap = snapshot({});
  const hand = snap.state.hands[0];

  it('選んでいないとき:出せるカードは選べる、出せないカードは暗い', () => {
    const controls = getHumanControls(snap, hand, null);
    expect(controls.cardStates).toEqual(['selectable', 'unplayable', 'unplayable']);
  });

  it('1枚選ぶと、そのカードは selected、他の出せるカードは blocked(点線)、出せないカードは暗いまま', () => {
    const two = snapshot({ hands: [[c('H', 5), c('H', 7), c('D', 3)], [c('C', 4)], [c('C', 4)], [c('C', 4)]] });
    const controls = getHumanControls(two, two.state.hands[0], c('H', 5));
    expect(controls.cardStates).toEqual(['selected', 'blocked', 'unplayable']);
  });

  it('自分の番でないときは、どのカードも選べない', () => {
    const other = snapshot({ currentPlayer: 1 });
    expect(getHumanControls(other, hand, null).cardStates).toEqual(['unplayable', 'unplayable', 'unplayable']);
  });

  it('①(ターン開始の表示中)は、まだ選べない', () => {
    const controls = getHumanControls(snapshot({}, 'turnStart'), hand, null);
    expect(controls.cardStates).toEqual(['unplayable', 'unplayable', 'unplayable']);
    expect(controls.draw.enabled).toBe(false);
  });

  it('手札が1枚のときは、出せるカードでも暗い(先にドロー)', () => {
    const one = snapshot({ hands: [[c('H', 5)], [c('C', 4)], [c('C', 4)], [c('C', 4)]] });
    const controls = getHumanControls(one, one.state.hands[0], null);
    expect(controls.cardStates).toEqual(['unplayable']);
    expect(controls.play.reason).toBe('mustDrawFirst');
    expect(controls.draw.enabled).toBe(true);
  });
});

describe('ボタンと、押せない理由(spec 4-3)', () => {
  it('② 出せるカードあり:カードを選ぶまでプレイは押せない(理由なし)。選ぶと押せる', () => {
    const snap = snapshot({});
    const hand = snap.state.hands[0];
    const none = getHumanControls(snap, hand, null);
    expect(none.play).toEqual({ enabled: false, reason: null });
    expect(none.draw).toEqual({ enabled: false, reason: 'hasPlayableCard' });
    expect(none.pass).toEqual({ enabled: false, reason: 'drawFirst' });
    expect(getHumanControls(snap, hand, c('H', 5)).play).toEqual({ enabled: true, reason: null });
  });

  it('② 出せるカードなし', () => {
    const snap = snapshot({ hands: [[c('D', 3), c('C', 2)], [c('C', 4)], [c('C', 4)], [c('C', 4)]] });
    const controls = getHumanControls(snap, snap.state.hands[0], null);
    expect(controls.play.reason).toBe('noPlayableCard');
    expect(controls.draw.enabled).toBe(true);
    expect(controls.pass.reason).toBe('drawFirst');
  });

  it('③ ドローのあと:出せるなら、ドローは1回だけ・パスは出せるカードがあります', () => {
    const snap = snapshot({ phase: 'afterDraw' });
    const controls = getHumanControls(snap, snap.state.hands[0], null);
    expect(controls.draw.reason).toBe('alreadyDrew');
    expect(controls.pass.reason).toBe('hasPlayableCard');
  });

  it('③ ドローのあと、出せなければパスできる', () => {
    const snap = snapshot({
      phase: 'afterDraw',
      hands: [[c('D', 3), c('C', 2)], [c('C', 4)], [c('C', 4)], [c('C', 4)]],
    });
    const controls = getHumanControls(snap, snap.state.hands[0], null);
    expect(controls.pass.enabled).toBe(true);
    expect(controls.play.reason).toBe('noPlayableCard');
  });

  it('自分の番でないときは、「自分の番ではありません」', () => {
    const controls = getHumanControls(snapshot({ currentPlayer: 2 }), [c('H', 5)], null);
    expect(controls.play).toEqual({ enabled: false, reason: 'notYourTurn' });
    expect(controls.draw.reason).toBe('notYourTurn');
    expect(controls.pass.reason).toBe('notYourTurn');
    expect(controls.main).toEqual({ kind: 'arm', enabled: false, reason: 'notYourTurn' });
  });

  it('張るボタンは、合計14以上だと理由が出る', () => {
    const big = snapshot({ hands: [[c('S', 13), c('S', 2)], [c('C', 4)], [c('C', 4)], [c('C', 4)]] });
    expect(getHumanControls(big, big.state.hands[0], null).main).toEqual({
      kind: 'arm',
      enabled: false,
      reason: 'totalTooHigh',
    });
  });
});

describe('メインボタン(張る / ドボン)の状態(wireframe.html の下の表)', () => {
  const main = (overrides: Partial<GameState>, stage: Stage = 'action') => {
    const snap = snapshot(overrides, stage);
    return getHumanControls(snap, snap.state.hands[0], null).main;
  };
  const small = [[c('H', 5), c('D', 3)], [c('C', 4)], [c('C', 4)], [c('C', 4)]] as const;

  it('張っていない・合計13以下・張れる時間 → 「張る」(押せる)', () => {
    expect(main({ hands: small })).toEqual({ kind: 'arm', enabled: true, reason: null });
    expect(main({ hands: small, phase: 'startWindow', topCardPlayedBy: null }, 'startWindow')).toEqual({
      kind: 'arm',
      enabled: true,
      reason: null,
    });
    expect(main({ hands: small, phase: 'accept' }, 'accept')).toEqual({ kind: 'arm', enabled: true, reason: null });
  });

  it('張れない時間 → 「張る」グレー+理由(自分のターンのみ)。①の間は理由なし', () => {
    expect(main({ hands: small, currentPlayer: 2 })).toEqual({ kind: 'arm', enabled: false, reason: 'notYourTurn' });
    expect(main({ hands: small }, 'turnStart')).toEqual({ kind: 'arm', enabled: false, reason: null });
  });

  it('仮押し中(②③) → 「張る(予約中)」', () => {
    expect(main({ hands: small, provisionalArm: [true, false, false, false] })).toEqual({ kind: 'armReserved' });
  });

  it('張り中・ドボン受付中・他の人のカード → 「ドボン」(上フリックで宣言できる)', () => {
    expect(
      main({ hands: small, armed: [true, false, false, false], dobonWindowOpen: true, topCardPlayedBy: 2 }),
    ).toEqual({ kind: 'dobon', mode: 'ready' });
  });

  it('張り中・受付の時間外 → 「ドボン」グレー', () => {
    expect(
      main({ hands: small, armed: [true, false, false, false], dobonWindowOpen: false, topCardPlayedBy: 2 }),
    ).toEqual({ kind: 'dobon', mode: 'closed' });
  });

  it('張り中・最初の場札 / 自分のカード → 「ドボン(対象外)」', () => {
    const armed = [true, false, false, false] as const;
    expect(main({ hands: small, armed, topCardPlayedBy: null })).toEqual({ kind: 'dobon', mode: 'notTarget' });
    expect(main({ hands: small, armed, dobonWindowOpen: true, topCardPlayedBy: 0 })).toEqual({
      kind: 'dobon',
      mode: 'notTarget',
    });
  });

  it('宣言ずみ → 「判定待ち…」', () => {
    expect(
      main(
        { hands: small, armed: [true, false, false, false], dobonWindowOpen: true, topCardPlayedBy: 2, declarations: [0] },
        'grace',
      ),
    ).toEqual({ kind: 'dobon', mode: 'judging' });
  });

  it('猶予の間(他の人が宣言したあと)も、まだ宣言していなければ、フリックできる(同じ判定に含まれる)', () => {
    expect(
      main(
        { hands: small, armed: [true, false, false, false], dobonWindowOpen: true, topCardPlayedBy: 2, declarations: [1] },
        'grace',
      ),
    ).toEqual({ kind: 'dobon', mode: 'ready' });
  });

  it('猶予の間は、プレイ・ドロー・パスの理由が「判定中」になる(自分の番のとき)', () => {
    const snap = snapshot(
      { phase: 'awaitAction', dobonWindowOpen: true, topCardPlayedBy: 3, declarations: [2], armed: [false, false, true, false] },
      'grace',
    );
    const controls = getHumanControls(snap, snap.state.hands[0], null);
    expect(controls.play).toEqual({ enabled: false, reason: 'resolutionPending' });
    expect(controls.draw).toEqual({ enabled: false, reason: 'resolutionPending' });
    expect(controls.pass).toEqual({ enabled: false, reason: 'resolutionPending' });
  });

  it('ゲームが終わったあとは、ドボンできない(グレー)', () => {
    expect(
      main(
        {
          hands: small,
          armed: [true, false, false, false],
          dobonWindowOpen: false,
          topCardPlayedBy: 2,
          phase: 'finished',
          result: { type: 'noContest' },
        },
        'ended',
      ),
    ).toEqual({ kind: 'dobon', mode: 'closed' });
  });
});

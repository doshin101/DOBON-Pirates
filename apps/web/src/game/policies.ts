import { getTurnOptions, type GameEvent, type GameResult } from '@dobon/core';
import { getHumanControls } from './controls';
import { createFakeScheduler } from './fakeScheduler';
import { GameRunner, HUMAN } from './GameRunner';
import { sortHand } from './sortHand';

/**
 * 人間の操作の方針(docs/mvp/test-seeds.md に書いてある手順と同じ)。
 * 同じシードで同じ方針なら、いつも同じ結果になる。シードを探す・結果を確かめるために使う。
 *
 * どちらの方針も、次のとおり操作する:
 *   1. 開始時のカウントダウン中に、「張る」が押せるなら押す
 *   2. 自分の番の最初(②)に、「張る」が押せるなら押す(予約)
 *   3. 出せるカードがあれば、手札の一番左の出せるカードを出す。なければドローし、
 *      ドローのあと出せるなら一番左の出せるカードを出し、出せなければパスする
 * ドボン(↑ドボンのボタンが出たとき)は、方針で違う:
 *   - standard:自分の合計が場札の数字と同じときだけ、すぐ上フリックする
 *   - reckless:出たらすぐ上フリックする(合計が合っていなくても。チョンボする)
 */
export type PolicyName = 'standard' | 'reckless';

export function stepHuman(runner: GameRunner, policy: PolicyName): void {
  const snap = runner.getSnapshot();
  const { state, stage } = snap;
  const hand = sortHand(state.hands[HUMAN]);
  const controls = getHumanControls(snap, hand, null);
  const main = controls.main;

  if (main.kind === 'dobon' && main.mode === 'ready') {
    const total = hand.reduce((sum, card) => sum + card.rank, 0);
    if (policy === 'reckless' || total === state.topCard.rank) {
      runner.humanDobon();
      return;
    }
  }
  if (stage === 'startWindow') {
    if (main.kind === 'arm' && main.enabled) runner.humanArm();
    return;
  }
  if (stage !== 'action' || state.currentPlayer !== HUMAN) return;
  if (state.phase === 'awaitAction' && main.kind === 'arm' && main.enabled) runner.humanArm();

  const options = getTurnOptions(state, HUMAN);
  const index = controls.cardStates.indexOf('selectable');
  const first = index >= 0 ? hand[index] : undefined;
  if (options.play.ok && first) runner.humanPlay(first);
  else if (options.draw.ok) runner.humanDraw();
  else if (options.pass.ok) runner.humanPass();
}

export interface PolicyGame {
  readonly seed: number;
  readonly policy: PolicyName;
  readonly result: GameResult;
  readonly turns: number;
  readonly events: readonly GameEvent[];
  /** 判定のとき、人間以外が宣言していたか(人間の操作が遅くても結果が変わらないかの目安) */
  readonly cpuDeclared: boolean;
}

/** 偽の時計で、1ゲームを最後まで自動で遊ぶ */
export function playWithPolicy(seed: number, policy: PolicyName, speed = 1): PolicyGame {
  const scheduler = createFakeScheduler();
  const runner = new GameRunner({ seed, speed, scheduler });
  runner.start();
  let guard = 0;
  while (runner.getSnapshot().stage !== 'ended') {
    if (guard++ > 400_000) throw new Error(`seed ${seed}: did not finish`);
    stepHuman(runner, policy);
    scheduler.advance(50);
  }
  const { state, log } = runner.getSnapshot();
  const events = log.map((entry) => entry.event);
  const declared = events.filter((e) => e.type === 'dobonDeclared');
  return {
    seed,
    policy,
    result: state.result as GameResult,
    turns: state.turnCount,
    events,
    cpuDeclared: declared.some((e) => e.type === 'dobonDeclared' && e.player !== HUMAN),
  };
}

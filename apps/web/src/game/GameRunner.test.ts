import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  PLAYER_IDS,
  createGame,
  createRng,
  getTurnOptions,
  playableCards,
  type PlayerId,
} from '@dobon/core';
import { GameRunner, HUMAN } from './GameRunner';
import { createFakeScheduler } from './fakeScheduler';

const startingPlayerOf = (seed: number): PlayerId => createGame(createRng(seed)).state.startingPlayer;

/** 親が人間のシード / 親がCPUのシードを探す */
const seedWhere = (predicate: (p: PlayerId) => boolean): number => {
  for (let seed = 1; seed < 100; seed++) if (predicate(startingPlayerOf(seed))) return seed;
  throw new Error('シードが見つからない');
};
const HUMAN_STARTS = seedWhere((p) => p === HUMAN);
const CPU_STARTS = seedWhere((p) => p !== HUMAN);

function setup(seed: number, speed = 1) {
  const scheduler = createFakeScheduler();
  const runner = new GameRunner({ seed, speed, scheduler });
  runner.start();
  return { runner, scheduler, snap: () => runner.getSnapshot() };
}

/** 人間の番になったら、出せるカードがあれば出し、なければドロー、ドロー後はパスする */
function humanAutoPlay(runner: GameRunner): void {
  const { state, stage } = runner.getSnapshot();
  if (stage !== 'action' || state.currentPlayer !== HUMAN) return;
  const options = getTurnOptions(state, HUMAN);
  const first = playableCards(state.hands[HUMAN], state.topCard)[0];
  if (options.play.ok && first) runner.humanPlay(first);
  else if (options.draw.ok) runner.humanDraw();
  else if (options.pass.ok) runner.humanPass();
}

describe('ターンの進み方とタイマー', () => {
  it('始めると、①(ターン開始)から TURN_START_MS のあと、②操作待機になる', () => {
    const { scheduler, snap } = setup(HUMAN_STARTS);
    expect(snap().stage).toBe('turnStart');
    expect(snap().state.phase).toBe('awaitAction');
    scheduler.advance(DEFAULT_PARAMS.TURN_START_MS - 1);
    expect(snap().stage).toBe('turnStart');
    scheduler.advance(1);
    expect(snap().stage).toBe('action');
  });

  it('人間の番は、時間無制限(何分たっても、勝手に操作されない)', () => {
    const { scheduler, snap } = setup(HUMAN_STARTS);
    scheduler.advance(10 * 60 * 1000);
    expect(snap().stage).toBe('action');
    expect(snap().state.currentPlayer).toBe(HUMAN);
    expect(snap().state.hands[HUMAN]).toHaveLength(3);
    expect(scheduler.pending()).toBe(0);
  });

  it('CPUの番は、CPU_THINK_MS の範囲のあとに、自分で操作する', () => {
    const { scheduler, snap } = setup(CPU_STARTS);
    const cpu = snap().state.currentPlayer;
    scheduler.advance(DEFAULT_PARAMS.TURN_START_MS);
    scheduler.advance(DEFAULT_PARAMS.CPU_THINK_MS[0] - 1);
    expect(snap().log.filter((e) => e.event.type === 'played' || e.event.type === 'drew')).toHaveLength(0);
    scheduler.advance(DEFAULT_PARAMS.CPU_THINK_MS[1] - DEFAULT_PARAMS.CPU_THINK_MS[0] + 1);
    const acted = snap().log.filter((e) => e.event.type === 'played' || e.event.type === 'drew');
    expect(acted.length).toBeGreaterThanOrEqual(1);
    expect(acted.every((e) => 'player' in e.event && e.event.player === cpu)).toBe(true);
  });

  it('人間がプレイしたあと、ACCEPT_MIN_MS(2500ms)たってから次の人のターンになる', () => {
    const seed = HUMAN_STARTS;
    const { runner, scheduler, snap } = setup(seed);
    scheduler.advance(DEFAULT_PARAMS.TURN_START_MS);
    // 出せるカードが手札にある場面にするため、ドローとプレイを繰り返して探す(最初の操作で出せなければドロー)
    for (let i = 0; i < 5 && snap().stage === 'action' && snap().state.phase !== 'accept'; i++) humanAutoPlay(runner);
    expect(snap().stage).toBe('accept');
    const played = snap().log.some((e) => e.event.type === 'played');
    const wait = played ? DEFAULT_PARAMS.ACCEPT_MIN_MS : DEFAULT_PARAMS.PASS_PAUSE_MS;
    scheduler.advance(wait - 1);
    expect(snap().state.currentPlayer).toBe(HUMAN);
    expect(snap().stage).toBe('accept');
    scheduler.advance(1);
    expect(snap().state.currentPlayer).toBe(1);
    expect(snap().stage).toBe('turnStart');
  });

  it('人間は、前の人の④が終わるまで操作できない', () => {
    const { runner, scheduler, snap } = setup(CPU_STARTS);
    const before = snap().log.length;
    expect(runner.humanDraw()).toBe(false);
    scheduler.advance(DEFAULT_PARAMS.TURN_START_MS);
    expect(runner.humanDraw()).toBe(false);
    expect(snap().log).toHaveLength(before);
  });

  it('速さ ×4 なら、すべての時間が4分の1になる', () => {
    const { scheduler, snap } = setup(HUMAN_STARTS, 4);
    scheduler.advance(DEFAULT_PARAMS.TURN_START_MS / 4 - 1);
    expect(snap().stage).toBe('turnStart');
    scheduler.advance(1);
    expect(snap().stage).toBe('action');
  });

  it('stop でタイマーが全部消え、start で続きから再開する', () => {
    const { runner, scheduler, snap } = setup(CPU_STARTS);
    runner.stop();
    expect(scheduler.pending()).toBe(0);
    scheduler.advance(60_000);
    expect(snap().stage).toBe('turnStart');
    runner.start();
    scheduler.advance(DEFAULT_PARAMS.TURN_START_MS + DEFAULT_PARAMS.CPU_THINK_MS[1]);
    expect(snap().log.some((e) => e.event.type === 'played' || e.event.type === 'drew')).toBe(true);
  });
});

describe('ゲーム全体', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('シード %i:人間も自動で遊ぶと、止まらず「引き分け」で終わる', (seed) => {
    const { runner, scheduler, snap } = setup(seed);
    let elapsed = 0;
    while (snap().stage !== 'ended' && elapsed < 60 * 60 * 1000) {
      humanAutoPlay(runner);
      scheduler.advance(100);
      elapsed += 100;
    }
    const final = snap();
    expect(final.stage).toBe('ended');
    // M2 は張りとドボンがないので、終わり方は引き分けだけ
    expect(final.state.result).toEqual({ type: 'noContest' });
    expect(final.state.stock).toHaveLength(0);
    expect(scheduler.pending()).toBe(0);
    // カードは1枚も増えたり減ったりしない
    const total =
      final.state.stock.length + final.state.hands.reduce((n, h) => n + h.length, 0) + final.state.discard.length;
    expect(total).toBe(52);
    expect(PLAYER_IDS.every((p) => final.state.hands[p].length >= 1)).toBe(true);
  });

  it('同じシードなら、同じ展開(CPUの選択は時間に左右されない)', () => {
    const play = (speed: number): string => {
      const { runner, scheduler, snap } = setup(3, speed);
      let guard = 0;
      while (snap().stage !== 'ended' && guard++ < 100_000) {
        humanAutoPlay(runner);
        scheduler.advance(50);
      }
      return JSON.stringify(snap().state.discard);
    };
    expect(play(1)).toBe(play(4));
  });
});

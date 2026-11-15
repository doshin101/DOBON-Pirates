import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  createGame,
  createRng,
  getTurnOptions,
  handTotal,
  playableCards,
  type PlayerId,
} from '@dobon/core';
import { getHumanControls } from './controls';
import { GameRunner, HUMAN, type Snapshot } from './GameRunner';
import { createFakeScheduler } from './fakeScheduler';
import { sortHand } from './sortHand';

const P = DEFAULT_PARAMS;

const dealt = (seed: number) => createGame(createRng(seed)).state;
const startingPlayerOf = (seed: number): PlayerId => dealt(seed).startingPlayer;

/** 条件に合うシードを探す */
const findSeed = (predicate: (seed: number) => boolean): number => {
  for (let seed = 1; seed < 500; seed++) if (predicate(seed)) return seed;
  throw new Error('シードが見つからない');
};
const HUMAN_STARTS = findSeed((s) => startingPlayerOf(s) === HUMAN);
const CPU_STARTS = findSeed((s) => startingPlayerOf(s) !== HUMAN);

function setup(seed: number, speed = 1) {
  const scheduler = createFakeScheduler();
  const runner = new GameRunner({ seed, speed, scheduler });
  runner.start();
  return { runner, scheduler, snap: (): Snapshot => runner.getSnapshot() };
}

/** 開始時の受付が終わって、①ターン開始になるまで進める(人間は張らない) */
function setupAfterStartWindow(seed: number, speed = 1) {
  const s = setup(seed, speed);
  s.scheduler.advance(P.START_WINDOW_MS / speed);
  return s;
}

/**
 * 人間の動かし方。
 * - careful:張らない・ドボンしない。出せるなら出し、出せなければドロー、ドローのあとはパス
 * - reckless:張れるときは張り、ドボンできるとき(受付中)は合計に関係なく宣言する(チョンボもする)
 */
function humanStep(runner: GameRunner, policy: 'careful' | 'reckless'): void {
  const snap = runner.getSnapshot();
  const { state } = snap;
  if (policy === 'reckless') {
    const main = getHumanControls(snap, sortHand(state.hands[HUMAN]), null).main;
    if (main.kind === 'dobon' && main.mode === 'ready') {
      runner.humanDobon();
      return;
    }
    if (main.kind === 'arm' && main.enabled) runner.humanArm();
  }
  if (snap.stage !== 'action' || state.currentPlayer !== HUMAN) return;
  const options = getTurnOptions(state, HUMAN);
  const first = playableCards(state.hands[HUMAN], state.topCard)[0];
  if (options.play.ok && first) runner.humanPlay(first);
  else if (options.draw.ok) runner.humanDraw();
  else if (options.pass.ok) runner.humanPass();
}

/** ゲームが終わる(結果画面になる)まで進める。通った段階も返す */
function playToEnd(seed: number, policy: 'careful' | 'reckless', speed = 1) {
  const { runner, scheduler, snap } = setup(seed, speed);
  const stages = new Set<string>();
  let guard = 0;
  while (snap().stage !== 'ended' && guard++ < 200_000) {
    humanStep(runner, policy);
    stages.add(snap().stage);
    scheduler.advance(50);
  }
  return { runner, scheduler, snap, stages };
}

describe('開始時の受付(spec 4-1)', () => {
  it('配った直後に、4秒のカウントダウン(4 → 3 → 2 → 1)。終わると親のターンが始まる', () => {
    const { scheduler, snap } = setup(HUMAN_STARTS);
    expect(snap().stage).toBe('startWindow');
    expect(snap().state.phase).toBe('startWindow');
    expect(snap().countdown).toBe(4);
    scheduler.advance(1000);
    expect(snap().countdown).toBe(3);
    scheduler.advance(1000);
    expect(snap().countdown).toBe(2);
    scheduler.advance(1000);
    expect(snap().countdown).toBe(1);
    scheduler.advance(P.START_WINDOW_MS - 3000 - 1);
    expect(snap().stage).toBe('startWindow');
    scheduler.advance(1);
    expect(snap().stage).toBe('turnStart');
    expect(snap().state.phase).toBe('awaitAction');
    expect(snap().countdown).toBeNull();
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'シード %i:合計13以下のCPUは必ず初張りする。14以上のCPUは張らない',
    (seed) => {
      const before = dealt(seed);
      const { scheduler, snap } = setup(seed);
      scheduler.advance(P.CPU_FIRST_ARM_DELAY_MS[1] + 1);
      for (const player of [1, 2, 3] as const) {
        expect(snap().state.armed[player]).toBe(handTotal(before.hands[player]) <= 13);
      }
      expect(snap().state.armed[HUMAN]).toBe(false);
    },
  );

  it('初張りのCPUは、CPU_FIRST_ARM_DELAY_MS(600〜1500ms)のあとに張る(それより前には張らない)', () => {
    const seed = findSeed((s) => [1, 2, 3].some((p) => handTotal(dealt(s).hands[p as 1 | 2 | 3]) <= 13));
    const { scheduler, snap } = setup(seed);
    scheduler.advance(P.CPU_FIRST_ARM_DELAY_MS[0] - 1);
    expect(snap().state.armed.some(Boolean)).toBe(false);
    scheduler.advance(P.CPU_FIRST_ARM_DELAY_MS[1]);
    expect(snap().state.armed.some(Boolean)).toBe(true);
  });

  it('誰かが張ると「○○が張った!」の知らせが出て、しばらくして消える', () => {
    const seed = findSeed((s) => [1, 2, 3].some((p) => handTotal(dealt(s).hands[p as 1 | 2 | 3]) <= 13));
    const { scheduler, snap } = setup(seed);
    scheduler.advance(P.CPU_FIRST_ARM_DELAY_MS[1] + 1);
    expect(snap().toasts.some((t) => t.kind === 'armed')).toBe(true);
    scheduler.advance(P.TOAST_MS + 3000);
    expect(snap().toasts).toHaveLength(0);
  });

  it('人間も、合計13以下なら、押した時点で張りが確定する。残りが短ければ FIRST_ARM_GRACE_MS(1.5秒)まで延びる', () => {
    const seed = findSeed((s) => handTotal(dealt(s).hands[HUMAN]) <= 13);
    const { runner, scheduler, snap } = setup(seed);
    scheduler.advance(3000); // 残り1秒
    expect(runner.humanArm()).toBe(true);
    expect(snap().state.armed[HUMAN]).toBe(true);
    scheduler.advance(P.FIRST_ARM_GRACE_MS - 1);
    expect(snap().stage).toBe('startWindow'); // 本来の終わり(あと1秒)を過ぎても続いている
    scheduler.advance(1);
    expect(snap().stage).toBe('turnStart');
  });

  it('残りが十分あるうちに張っても、延びない', () => {
    const seed = findSeed((s) => handTotal(dealt(s).hands[HUMAN]) <= 13);
    const { runner, scheduler, snap } = setup(seed);
    scheduler.advance(500);
    runner.humanArm();
    scheduler.advance(P.START_WINDOW_MS - 500);
    expect(snap().stage).toBe('turnStart');
  });

  it('人間の合計が14以上なら、張れない', () => {
    const seed = findSeed((s) => handTotal(dealt(s).hands[HUMAN]) > 13);
    const { runner, snap } = setup(seed);
    expect(runner.humanArm()).toBe(false);
    expect(snap().state.armed[HUMAN]).toBe(false);
  });

  it('受付の間は、プレイ・ドロー・パスはできない', () => {
    const { runner, snap } = setup(HUMAN_STARTS);
    expect(runner.humanDraw()).toBe(false);
    expect(runner.humanPass()).toBe(false);
    expect(snap().state.hands[HUMAN]).toHaveLength(3);
  });

  it('最初の場札には、ドボンできない(張っていても受け付けない)', () => {
    const seed = findSeed((s) => handTotal(dealt(s).hands[HUMAN]) <= 13);
    const { runner, scheduler } = setup(seed);
    runner.humanArm();
    expect(runner.humanDobon()).toBe(false);
    scheduler.advance(P.START_WINDOW_MS);
    expect(runner.humanDobon()).toBe(false); // ターンが始まっても、最初の場札は対象外
  });
});

describe('ターンの進み方とタイマー', () => {
  it('①(ターン開始)から TURN_START_MS のあと、②操作待機になる', () => {
    const { scheduler, snap } = setupAfterStartWindow(HUMAN_STARTS);
    expect(snap().stage).toBe('turnStart');
    scheduler.advance(P.TURN_START_MS - 1);
    expect(snap().stage).toBe('turnStart');
    scheduler.advance(1);
    expect(snap().stage).toBe('action');
  });

  it('人間の番は、時間無制限(何分たっても、勝手に操作されない)', () => {
    const { scheduler, snap } = setupAfterStartWindow(HUMAN_STARTS);
    scheduler.advance(10 * 60 * 1000);
    expect(snap().stage).toBe('action');
    expect(snap().state.currentPlayer).toBe(HUMAN);
    expect(snap().state.hands[HUMAN]).toHaveLength(3);
    expect(scheduler.pending()).toBe(0);
  });

  it('CPUの番は、CPU_THINK_MS の範囲のあとに、自分で操作する', () => {
    const { scheduler, snap } = setupAfterStartWindow(CPU_STARTS);
    const cpu = snap().state.currentPlayer;
    const acted = () => snap().log.filter((e) => e.event.type === 'played' || e.event.type === 'drew');
    scheduler.advance(P.TURN_START_MS);
    scheduler.advance(P.CPU_THINK_MS[0] - 1);
    expect(acted()).toHaveLength(0);
    scheduler.advance(P.CPU_THINK_MS[1] - P.CPU_THINK_MS[0] + 1);
    expect(acted().length).toBeGreaterThanOrEqual(1);
    expect(acted().every((e) => 'player' in e.event && e.event.player === cpu)).toBe(true);
  });

  it('人間がプレイ(またはパス)したあと、④の時間(2.5秒 / 0.6秒)たってから次の人のターンになる', () => {
    const { runner, scheduler, snap } = setupAfterStartWindow(HUMAN_STARTS);
    scheduler.advance(P.TURN_START_MS);
    for (let i = 0; i < 5 && snap().stage === 'action'; i++) humanStep(runner, 'careful');
    expect(snap().stage).toBe('accept');
    const played = snap().log.some((e) => e.event.type === 'played');
    const wait = played ? P.ACCEPT_MIN_MS : P.PASS_PAUSE_MS;
    scheduler.advance(wait - 1);
    expect(snap().state.currentPlayer).toBe(HUMAN);
    expect(snap().stage).toBe('accept');
    scheduler.advance(1);
    expect(snap().state.currentPlayer).toBe(1);
    expect(snap().stage).toBe('turnStart');
  });

  it('人間は、前の人の④が終わるまで操作できない', () => {
    const { runner, scheduler, snap } = setupAfterStartWindow(CPU_STARTS);
    const before = snap().log.length;
    expect(runner.humanDraw()).toBe(false);
    scheduler.advance(P.TURN_START_MS);
    expect(runner.humanDraw()).toBe(false);
    expect(snap().log).toHaveLength(before);
  });

  it('速さ ×4 なら、すべての時間が4分の1になる(開始時の受付も)', () => {
    const { scheduler, snap } = setup(HUMAN_STARTS, 4);
    scheduler.advance(P.START_WINDOW_MS / 4 - 1);
    expect(snap().stage).toBe('startWindow');
    scheduler.advance(1);
    expect(snap().stage).toBe('turnStart');
    scheduler.advance(P.TURN_START_MS / 4);
    expect(snap().stage).toBe('action');
  });

  it('stop でタイマーが全部消え、start で続きから再開する', () => {
    const { runner, scheduler, snap } = setupAfterStartWindow(CPU_STARTS);
    runner.stop();
    expect(scheduler.pending()).toBe(0);
    scheduler.advance(60_000);
    expect(snap().stage).toBe('turnStart');
    runner.start();
    scheduler.advance(P.TURN_START_MS + P.CPU_THINK_MS[1]);
    expect(snap().log.some((e) => e.event.type === 'played' || e.event.type === 'drew')).toBe(true);
  });
});

describe('ゲーム全体:人間が張らない(careful)', () => {
  it.each(Array.from({ length: 30 }, (_, i) => i + 1))(
    'シード %i:止まらず、ドボンか引き分けで終わる(チョンボは起きない)',
    (seed) => {
      const { snap, scheduler, stages } = playToEnd(seed, 'careful');
      const final = snap();
      expect(final.stage).toBe('ended');
      expect(final.state.phase).toBe('finished');
      const result = final.state.result!;
      expect(['dobon', 'noContest']).toContain(result.type);
      if (result.type === 'dobon') {
        expect(stages.has('flash')).toBe(true); // 「ドボン!」の表示を通る
        expect(result.winner).not.toBe(HUMAN); // 人間は張っていないので、勝てない
        expect(final.state.armed[result.winner]).toBe(true);
        expect(handTotal(final.state.hands[result.winner])).toBe(final.state.topCard.rank);
        expect(final.state.topCardPlayedBy).toBe(result.loser);
      } else {
        expect(stages.has('flash')).toBe(false); // 引き分けは、すぐ結果へ
        expect(final.state.stock).toHaveLength(0);
      }
      scheduler.advance(P.TOAST_MS + 100); // 知らせ(トースト)が消えたら、動いているタイマーは残らない
      expect(scheduler.pending()).toBe(0);
      const total =
        final.state.stock.length + final.state.hands.reduce((n, h) => n + h.length, 0) + final.state.discard.length;
      expect(total).toBe(52);
    },
  );

  it('猶予の間は、ターンが進まない。GRACE_MS のあと判定され、RESULT_FLASH_MS のあと結果になる', () => {
    // CPUのドボンで終わるシードを探して、段階を1つずつ確かめる
    let checked = false;
    for (let seed = 1; seed < 60 && !checked; seed++) {
      const { runner, scheduler, snap } = setup(seed);
      let guard = 0;
      while (snap().stage !== 'grace' && snap().stage !== 'ended' && guard++ < 1_000_000) {
        humanStep(runner, 'careful');
        scheduler.advance(1); // 宣言の瞬間(1ms以内)に気づけるよう、細かく進める
      }
      if (snap().stage !== 'grace') continue;
      const turn = snap().state.turnCount;
      const current = snap().state.currentPlayer;
      // 宣言から GRACE_MS(1秒)たつまでは、判定されず、ターンも進まない
      scheduler.advance(P.GRACE_MS - 2);
      expect(snap().stage).toBe('grace');
      expect(snap().state.phase).not.toBe('finished');
      expect(snap().state.turnCount).toBe(turn);
      expect(snap().state.currentPlayer).toBe(current);
      scheduler.advance(3);
      expect(snap().state.phase).toBe('finished');
      expect(snap().stage).toBe('flash');
      scheduler.advance(P.RESULT_FLASH_MS - 3);
      expect(snap().stage).toBe('flash');
      scheduler.advance(4);
      expect(snap().stage).toBe('ended');
      checked = true;
    }
    expect(checked).toBe(true);
  });

  it('同じシードなら、速さが違っても同じ展開(CPUの選択は時間に左右されない)', () => {
    const final = (speed: number) => {
      const { snap } = playToEnd(3, 'careful', speed);
      return JSON.stringify({ discard: snap().state.discard, result: snap().state.result });
    };
    expect(final(1)).toBe(final(4));
  });
});

describe('ゲーム全体:人間が張って、ドボンも宣言する(reckless)', () => {
  const results = Array.from({ length: 60 }, (_, i) => i + 1).map((seed) => ({
    seed,
    ...playToEnd(seed, 'reckless'),
  }));

  it('全ゲームが、止まらずに終わる', () => {
    for (const r of results) {
      expect(r.snap().stage).toBe('ended');
      expect(r.scheduler.pending()).toBe(0);
    }
  });

  it('合計が合っていないのに宣言すると、チョンボで負けになる(勝者なし)', () => {
    const fouls = results.filter((r) => r.snap().state.result?.type === 'foul');
    expect(fouls.length).toBeGreaterThan(0);
    for (const r of fouls) {
      const result = r.snap().state.result!;
      if (result.type !== 'foul') continue;
      expect(result.losers).toContain(HUMAN);
      expect(r.stages.has('flash')).toBe(true);
    }
  });

  it('合計が合っていれば、人間がドボンして勝てる(敗者はそのカードをプレイした人)', () => {
    const wins = results.filter((r) => {
      const res = r.snap().state.result;
      return res?.type === 'dobon' && res.winner === HUMAN;
    });
    expect(wins.length).toBeGreaterThan(0);
    for (const r of wins) {
      const s = r.snap().state;
      const res = s.result!;
      if (res.type !== 'dobon') continue;
      expect(handTotal(s.hands[HUMAN])).toBe(s.topCard.rank);
      expect(s.topCardPlayedBy).toBe(res.loser);
      expect(res.loser).not.toBe(HUMAN);
    }
  });

  it('人間が宣言すると、すぐ「判定待ち」になり、猶予のあと判定される', () => {
    const r = results.find((x) => x.snap().state.declarations.includes(HUMAN))!;
    expect(r).toBeDefined();
    // もう一度、同じシードで、宣言の瞬間を確かめる
    const { runner, scheduler, snap } = setup(r.seed);
    let guard = 0;
    while (!snap().state.declarations.includes(HUMAN) && guard++ < 100_000) {
      humanStep(runner, 'reckless');
      scheduler.advance(50);
    }
    expect(snap().stage).toBe('grace');
    const main = getHumanControls(snap(), sortHand(snap().state.hands[HUMAN]), null).main;
    expect(main).toEqual({ kind: 'dobon', mode: 'judging' });
    expect(runner.humanDobon()).toBe(false); // 1回の受付で、宣言は1人1回
    scheduler.advance(P.GRACE_MS + 50);
    expect(snap().state.phase).toBe('finished');
  });
});

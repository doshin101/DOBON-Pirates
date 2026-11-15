import {
  DEFAULT_PARAMS,
  applyAction,
  createGame,
  createRng,
  getPlayerView,
  type Action,
  type Card,
  type GameEvent,
  type GameState,
  type Params,
  type PlayerId,
  type Range,
  type Rng,
} from '@dobon/core';
import { decide, toAction } from '@dobon/cpu';

/** 時計の役。テストでは偽物に差し替えて、時間を早送りする */
export interface Scheduler {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const browserScheduler: Scheduler = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * 画面から見たターンの段階(spec 4-2)。
 * - turnStart:①「○○の番」の表示中(操作はできない)
 * - action:②③ 操作待機・操作中(人間は時間無制限。CPUは少し待って操作する)
 * - accept:④ 操作完了の直後(プレイなら ACCEPT_MIN_MS、パスなら PASS_PAUSE_MS)
 * - ended:ゲーム終了
 */
export type Stage = 'turnStart' | 'action' | 'accept' | 'ended';

export interface LogEntry {
  readonly id: number;
  readonly event: GameEvent;
}

export interface Snapshot {
  readonly state: GameState;
  readonly stage: Stage;
  readonly log: readonly LogEntry[];
  readonly seed: number;
  readonly speed: number;
}

export interface RunnerOptions {
  readonly seed: number;
  /** 進行の速さ。2 なら、すべての時間を半分にする */
  readonly speed?: number;
  readonly params?: Params;
  readonly scheduler?: Scheduler;
}

/** 人間の席 */
export const HUMAN: PlayerId = 0;

/**
 * ゲームの進行役。core に「操作」を渡して新しい状態を受け取り、時間(タイマー)を管理する。
 * M2 では張りとドボンは使わない(CPUも張らない・ドボンしない)。開始時の受付も飛ばす。
 */
export class GameRunner {
  private readonly params: Params;
  private readonly scheduler: Scheduler;
  private readonly seed: number;
  private readonly rng: Rng;
  /** 待ち時間用の乱数。CPUの選択に使う乱数とは分けて、展開が時間に左右されないようにする */
  private readonly timingRng: Rng;

  private state: GameState;
  private stage: Stage = 'turnStart';
  private log: LogEntry[] = [];
  private speed: number;
  private running = false;
  private timer: unknown = null;
  private acceptMs = 0;
  private nextLogId = 1;
  private snapshot: Snapshot;
  private readonly listeners = new Set<() => void>();

  constructor(options: RunnerOptions) {
    this.seed = options.seed;
    this.speed = options.speed ?? 1;
    this.params = options.params ?? DEFAULT_PARAMS;
    this.scheduler = options.scheduler ?? browserScheduler;
    this.rng = createRng(options.seed);
    this.timingRng = createRng(options.seed ^ 0x9e3779b9);
    const created = createGame(this.rng);
    this.state = created.state;
    this.record(created.events);
    this.snapshot = this.makeSnapshot();
  }

  // ---- 画面から使うところ ----

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): Snapshot => this.snapshot;

  /** 始める(止めたあとに呼ぶと、続きから再開する) */
  start(): void {
    if (this.running) return;
    this.running = true;
    if (this.state.phase === 'startWindow') {
      // M2:開始時の受付は行わず、すぐ親のターンを始める(M3 で作る)
      this.apply({ type: 'endStartWindow' });
      this.stage = 'turnStart';
      this.emit();
    }
    this.resume();
  }

  /** 止める(タイマーを全部消す) */
  stop(): void {
    this.running = false;
    this.clearTimer();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.emit();
    this.resume();
  }

  /** 人間の操作。自分の番の②③のときだけ受け付ける。受け付けたら true */
  humanPlay(card: Card): boolean {
    return this.humanAct({ type: 'play', player: HUMAN, card });
  }
  humanDraw(): boolean {
    return this.humanAct({ type: 'draw', player: HUMAN });
  }
  humanPass(): boolean {
    return this.humanAct({ type: 'pass', player: HUMAN });
  }

  // ---- 中のしくみ ----

  private humanAct(action: Action): boolean {
    if (!this.running || this.stage !== 'action' || this.state.currentPlayer !== HUMAN) return false;
    if (!this.apply(action)) return false;
    this.afterAction(action);
    return true;
  }

  /** core に操作を渡す。受け付けられなければ false(状態は変わらない) */
  private apply(action: Action): boolean {
    const result = applyAction(this.state, action);
    if (!result.ok) return false;
    this.state = result.state;
    this.record(result.events);
    return true;
  }

  /** プレイ・ドロー・パスのあとの進め方 */
  private afterAction(action: Action): void {
    if (this.state.phase === 'finished') {
      this.stage = 'ended';
    } else if (this.state.phase === 'accept') {
      this.stage = 'accept';
      this.acceptMs = action.type === 'play' ? this.params.ACCEPT_MIN_MS : this.params.PASS_PAUSE_MS;
    } else {
      this.stage = 'action'; // ドローのあと(③)
    }
    this.emit();
    this.resume();
  }

  /** いまの段階に合わせて、次のタイマーを仕掛ける */
  private resume(): void {
    this.clearTimer();
    if (!this.running) return;
    switch (this.stage) {
      case 'turnStart':
        this.later(this.params.TURN_START_MS, () => {
          this.stage = 'action';
          this.emit();
          this.resume();
        });
        break;
      case 'action':
        if (this.state.currentPlayer !== HUMAN) this.later(this.pick(this.params.CPU_THINK_MS), () => this.cpuAct());
        break;
      case 'accept':
        this.later(this.acceptMs, () => {
          if (this.apply({ type: 'endTurn' })) {
            this.stage = 'turnStart';
            this.emit();
            this.resume();
          }
        });
        break;
      case 'ended':
        break;
    }
  }

  private cpuAct(): void {
    const player = this.state.currentPlayer;
    const action = toAction(decide(getPlayerView(this.state, player), this.rng), player);
    if (!action || !this.apply(action)) {
      throw new Error(`CPU ${player} の操作が受け付けられなかった: ${JSON.stringify(action)}`);
    }
    this.afterAction(action);
  }

  private later(ms: number, callback: () => void): void {
    this.timer = this.scheduler.setTimeout(callback, ms / this.speed);
  }

  private clearTimer(): void {
    if (this.timer !== null) this.scheduler.clearTimeout(this.timer);
    this.timer = null;
  }

  private pick([min, max]: Range): number {
    return min + this.timingRng.next() * (max - min);
  }

  private record(events: readonly GameEvent[]): void {
    for (const event of events) this.log.push({ id: this.nextLogId++, event });
  }

  private makeSnapshot(): Snapshot {
    return {
      state: this.state,
      stage: this.stage,
      log: this.log,
      seed: this.seed,
      speed: this.speed,
    };
  }

  private emit(): void {
    this.log = [...this.log];
    this.snapshot = this.makeSnapshot();
    for (const listener of [...this.listeners]) listener();
  }
}

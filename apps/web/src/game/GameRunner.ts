import {
  DEFAULT_PARAMS,
  PLAYER_IDS,
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
  /** いまの時刻(ミリ秒) */
  now(): number;
}

export const browserScheduler: Scheduler = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => globalThis.performance.now(),
};

/**
 * 画面から見た進み具合(spec 4-1、4-2、6-3)。
 * - startWindow:開始時の受付(カウントダウン。初張りができる)
 * - turnStart:①「○○の番」の表示中(操作はできない)
 * - action:②③ 操作待機・操作中(人間は時間無制限。CPUは少し待って操作する)
 * - accept:④ 操作完了の直後(プレイなら ACCEPT_MIN_MS、パスなら PASS_PAUSE_MS)
 * - grace:ドボンの宣言があって、判定を待っている(猶予)。ターンは止まる
 * - flash:「ドボン!」「チョンボ!」の表示中
 * - ended:結果画面
 */
export type Stage =
  | 'startWindow'
  | 'turnStart'
  | 'action'
  | 'accept'
  | 'grace'
  | 'flash'
  | 'ended';

export interface LogEntry {
  readonly id: number;
  readonly event: GameEvent;
}

/** 画面に少しだけ出す知らせ(「○○が張った!」「○○ 継続」など) */
export interface Toast {
  readonly id: number;
  readonly kind: 'armed' | 'armFailed' | 'disarmed' | 'stillArmed';
  readonly player: PlayerId;
  /** 張れなかったときの合計 */
  readonly total?: number;
}

export interface Snapshot {
  readonly state: GameState;
  readonly stage: Stage;
  readonly log: readonly LogEntry[];
  readonly toasts: readonly Toast[];
  /** 開始時の受付のカウントダウン(4・3・2・1)。受付中でなければ null */
  readonly countdown: number | null;
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

/** タイマーのグループ。flow=ゲームの進行、cpu=CPUの張り・ドボン、toast=知らせの表示 */
type Group = 'flow' | 'cpu' | 'toast';

const TICK_MS = 100;
const MAX_TOASTS = 3;

/**
 * ゲームの進行役。core に「操作」を渡して新しい状態を受け取り、時間(タイマー)を管理する。
 * - 開始時の受付 → 親のターン → ターンの繰り返し(spec 4節)
 * - CPUの初張り・張り・ドボン(spec 7節)
 * - ドボンの宣言から猶予 → 判定 → 「ドボン!」の表示 → 結果(spec 6節)
 */
export class GameRunner {
  private readonly params: Params;
  private readonly scheduler: Scheduler;
  private readonly seed: number;
  private readonly rng: Rng;
  /** 待ち時間用の乱数。CPUの選択に使う乱数とは分けて、展開が時間に左右されないようにする */
  private readonly timingRng: Rng;

  private state: GameState;
  private stage: Stage = 'startWindow';
  private log: LogEntry[] = [];
  private toasts: Toast[] = [];
  private countdown: number | null;
  private speed: number;
  private running = false;
  private readonly timers: Record<Group, Set<unknown>> = {
    flow: new Set(),
    cpu: new Set(),
    toast: new Set(),
  };
  /** 開始時の受付が終わる時刻(scheduler.now() の値) */
  private deadline: number | null = null;
  private acceptMs = 0;
  private nextId = 1;
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
    this.countdown = Math.ceil(this.params.START_WINDOW_MS / 1000);
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
    this.resume();
  }

  /** 止める(タイマーを全部消す) */
  stop(): void {
    this.running = false;
    this.clearAll();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.emit();
    if (this.running) this.resume();
  }

  /** 人間の操作。受け付けたら true */
  humanPlay(card: Card): boolean {
    return this.humanAct({ type: 'play', player: HUMAN, card });
  }
  humanDraw(): boolean {
    return this.humanAct({ type: 'draw', player: HUMAN });
  }
  humanPass(): boolean {
    return this.humanAct({ type: 'pass', player: HUMAN });
  }

  /** 張るボタン。開始時の受付、または自分のターンの②③④のとき(②③は仮押し) */
  humanArm(): boolean {
    if (!this.running) return false;
    const myTurn = this.state.currentPlayer === HUMAN;
    const allowed =
      this.stage === 'startWindow' || (myTurn && (this.stage === 'action' || this.stage === 'accept'));
    if (!allowed) return false;
    return this.apply({ type: 'arm', player: HUMAN }) !== null;
  }

  /** ドボンの宣言(上フリック)。宣言を受け付けたら true */
  humanDobon(): boolean {
    if (!this.running) return false;
    if (this.stage === 'startWindow' || this.stage === 'flash' || this.stage === 'ended') return false;
    const events = this.apply({ type: 'dobon', player: HUMAN });
    return events !== null && events.some((e) => e.type === 'dobonDeclared');
  }

  // ---- 人間のプレイ・ドロー・パス ----

  private humanAct(action: Action): boolean {
    if (!this.running || this.stage !== 'action' || this.state.currentPlayer !== HUMAN) return false;
    if (this.apply(action) === null) return false;
    this.afterAction(action);
    return true;
  }

  // ---- core とのやりとり ----

  /** core に操作を渡す。受け付けられなければ null(状態は変わらない) */
  private apply(action: Action): readonly GameEvent[] | null {
    const result = applyAction(this.state, action);
    if (!result.ok) return null;
    this.state = result.state;
    this.record(result.events);
    this.handleEvents(result.events);
    return result.events;
  }

  /** 起きたことに応じた、画面側の動き(知らせ、猶予、終了) */
  private handleEvents(events: readonly GameEvent[]): void {
    let declared = false;
    for (const event of events) {
      switch (event.type) {
        case 'armed':
          this.addToast({ kind: 'armed', player: event.player }, this.params.TOAST_MS);
          if (event.source === 'first' && this.stage === 'startWindow') this.extendStartWindow();
          break;
        case 'armFailed':
          this.addToast(
            { kind: 'armFailed', player: event.player, total: event.handTotal },
            this.params.TOAST_MS,
          );
          break;
        case 'disarmed':
          this.addToast({ kind: 'disarmed', player: event.player }, this.params.TOAST_MS);
          break;
        case 'stillArmed':
          this.addToast({ kind: 'stillArmed', player: event.player }, this.params.STILL_ARMED_TOAST_MS);
          break;
        case 'dobonDeclared':
          declared = true;
          break;
        default:
          break;
      }
    }
    if (this.state.phase === 'finished') {
      this.onFinished();
    } else if (declared && this.stage !== 'grace') {
      this.startGrace();
    }
    this.emit();
  }

  /** プレイ・ドロー・パスのあとの進め方 */
  private afterAction(action: Action): void {
    if (this.state.phase === 'finished') return; // 終了の処理は handleEvents で済んでいる
    const mover = this.state.currentPlayer;
    if (this.state.phase === 'accept') {
      this.stage = 'accept';
      this.acceptMs = action.type === 'play' ? this.params.ACCEPT_MIN_MS : this.params.PASS_PAUSE_MS;
      // CPUは、操作完了の直後(④の始め)に、張れるなら必ず張る(spec 7節)
      if (mover !== HUMAN) {
        const decision = decide(getPlayerView(this.state, mover), this.rng);
        const arm = toAction(decision, mover);
        if (arm?.type === 'arm') this.apply(arm);
      }
      if (action.type === 'play') this.scheduleCpuDobons(mover);
    } else {
      this.stage = 'action'; // ドローのあと(③)
    }
    this.emit();
    this.resume();
  }

  // ---- タイマー ----

  /** いまの段階に合わせて、進行のタイマーを仕掛け直す */
  private resume(): void {
    this.clear('flow');
    if (!this.running) return;
    switch (this.stage) {
      case 'startWindow':
        this.resumeStartWindow();
        break;
      case 'turnStart':
        this.later('flow', this.params.TURN_START_MS, () => {
          this.stage = 'action';
          this.emit();
          this.resume();
        });
        break;
      case 'action':
        if (this.state.currentPlayer !== HUMAN) {
          this.later('flow', this.pick(this.params.CPU_THINK_MS), () => this.cpuAct());
        }
        break;
      case 'accept':
        this.later('flow', this.acceptMs, () => this.endTurn());
        break;
      case 'grace':
        this.later('flow', this.params.GRACE_MS, () => {
          this.apply({ type: 'resolve' });
        });
        break;
      case 'flash':
        this.later('flow', this.params.RESULT_FLASH_MS, () => {
          this.stage = 'ended';
          this.emit();
        });
        break;
      case 'ended':
        break;
    }
  }

  private endTurn(): void {
    if (this.apply({ type: 'endTurn' }) === null) return;
    this.stage = 'turnStart';
    this.emit();
    this.resume();
  }

  private cpuAct(): void {
    if (this.stage !== 'action') return;
    const player = this.state.currentPlayer;
    const action = toAction(decide(getPlayerView(this.state, player), this.rng), player);
    if (!action || this.apply(action) === null) {
      throw new Error(`CPU ${player} action rejected: ${JSON.stringify(action)}`);
    }
    this.afterAction(action);
  }

  // ---- 開始時の受付 ----

  private resumeStartWindow(): void {
    if (this.deadline === null) this.deadline = this.scheduler.now() + this.params.START_WINDOW_MS / this.speed;
    // CPUは、合計が13以下なら必ず初張りする(配られてから CPU_FIRST_ARM_DELAY_MS のあと)
    this.clear('cpu');
    for (const player of PLAYER_IDS) {
      if (player === HUMAN) continue;
      if (decide(getPlayerView(this.state, player), this.rng).kind !== 'arm') continue;
      this.later('cpu', this.pick(this.params.CPU_FIRST_ARM_DELAY_MS), () => {
        if (this.stage === 'startWindow') this.apply({ type: 'arm', player });
      });
    }
    this.scheduleStartWindowTimers();
  }

  /** 開始時の受付の終わりと、カウントダウンの更新 */
  private scheduleStartWindowTimers(): void {
    this.updateCountdown();
    this.later('flow', this.remainingGameMs(), () => this.endStartWindow());
    this.later('flow', TICK_MS * this.speed, () => this.tick());
  }

  private tick(): void {
    if (this.stage !== 'startWindow') return;
    this.updateCountdown();
    this.later('flow', TICK_MS * this.speed, () => this.tick());
  }

  private remainingGameMs(): number {
    if (this.deadline === null) return 0;
    return Math.max(0, (this.deadline - this.scheduler.now()) * this.speed);
  }

  private updateCountdown(): void {
    const next = Math.max(1, Math.ceil(this.remainingGameMs() / 1000));
    if (next !== this.countdown) {
      this.countdown = next;
      this.emit();
    }
  }

  /** 誰かが初張りしたとき、残りが FIRST_ARM_GRACE_MS より短ければ、そこまで延ばす(spec 4-1) */
  private extendStartWindow(): void {
    if (this.deadline === null) return;
    if (this.remainingGameMs() >= this.params.FIRST_ARM_GRACE_MS) return;
    this.deadline = this.scheduler.now() + this.params.FIRST_ARM_GRACE_MS / this.speed;
    this.clear('flow');
    this.scheduleStartWindowTimers();
  }

  private endStartWindow(): void {
    if (this.apply({ type: 'endStartWindow' }) === null) return;
    this.deadline = null;
    this.countdown = null;
    this.stage = 'turnStart';
    this.emit();
    this.resume();
  }

  // ---- ドボン ----

  /** カードがプレイされた直後に、ドボンできるCPUの宣言を仕掛ける(受付が始まってから CPU_DOBON_REACTION_MS のあと) */
  private scheduleCpuDobons(mover: PlayerId): void {
    for (const player of PLAYER_IDS) {
      if (player === HUMAN || player === mover) continue;
      if (decide(getPlayerView(this.state, player), this.rng).kind !== 'dobon') continue;
      this.later('cpu', this.pick(this.params.CPU_DOBON_REACTION_MS), () => {
        if (this.state.phase !== 'finished') this.apply({ type: 'dobon', player });
      });
    }
  }

  /** 宣言があった。猶予の間は、ターンを止める。猶予の間の宣言も同じ判定に含まれる */
  private startGrace(): void {
    this.stage = 'grace';
    this.clear('flow');
    if (this.running) this.resume();
  }

  /** ゲームが終わった。ドボン・チョンボなら「ドボン!」の表示のあと結果へ。引き分けはすぐ結果へ */
  private onFinished(): void {
    this.clear('flow');
    this.clear('cpu');
    this.stage = this.state.result?.type === 'noContest' ? 'ended' : 'flash';
    if (this.running) this.resume();
  }

  // ---- 部品 ----

  private later(group: Group, ms: number, callback: () => void): void {
    const handle = this.scheduler.setTimeout(() => {
      this.timers[group].delete(handle);
      callback();
    }, ms / this.speed);
    this.timers[group].add(handle);
  }

  private clear(group: Group): void {
    for (const handle of this.timers[group]) this.scheduler.clearTimeout(handle);
    this.timers[group].clear();
  }

  private clearAll(): void {
    this.clear('flow');
    this.clear('cpu');
    this.clear('toast');
  }

  private addToast(toast: Omit<Toast, 'id'>, ms: number): void {
    const entry: Toast = { ...toast, id: this.nextId++ };
    this.toasts = [...this.toasts, entry].slice(-MAX_TOASTS);
    this.later('toast', ms, () => {
      this.toasts = this.toasts.filter((t) => t.id !== entry.id);
      this.emit();
    });
  }

  private pick([min, max]: Range): number {
    return min + this.timingRng.next() * (max - min);
  }

  private record(events: readonly GameEvent[]): void {
    for (const event of events) this.log.push({ id: this.nextId++, event });
  }

  private makeSnapshot(): Snapshot {
    return {
      state: this.state,
      stage: this.stage,
      log: this.log,
      toasts: this.toasts,
      countdown: this.stage === 'startWindow' ? this.countdown : null,
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

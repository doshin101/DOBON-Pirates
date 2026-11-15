// テスト用の偽の時計。advance(ms) で、時間を好きなだけ進められる。
import type { Scheduler } from './GameRunner';

export interface FakeScheduler extends Scheduler {
  /** 時間を ms 進めて、期限が来たタイマーを順に実行する */
  advance(ms: number): void;
  /** まだ動いていないタイマーの数 */
  pending(): number;
  now(): number;
}

export function createFakeScheduler(): FakeScheduler {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, { due: number; callback: () => void }>();

  return {
    setTimeout(callback, ms) {
      const id = nextId++;
      timers.set(id, { due: now + ms, callback });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let nextDue = Infinity;
        let nextTimer = -1;
        for (const [id, t] of timers) {
          if (t.due <= target && t.due < nextDue) {
            nextDue = t.due;
            nextTimer = id;
          }
        }
        if (nextTimer === -1) break;
        const timer = timers.get(nextTimer)!;
        timers.delete(nextTimer);
        now = Math.max(now, timer.due);
        timer.callback();
      }
      now = target;
    },
    pending: () => timers.size,
    now: () => now,
  };
}

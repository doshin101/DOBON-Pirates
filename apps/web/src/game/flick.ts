/** 上フリックの判定。指(マウス)を押した位置から、上に threshold px 動いた時点で1回だけ true を返す */
export const FLICK_THRESHOLD_PX = 48;

export class FlickTracker {
  private startY: number | null = null;
  private fired = false;

  constructor(private readonly threshold: number = FLICK_THRESHOLD_PX) {}

  start(y: number): void {
    this.startY = y;
    this.fired = false;
  }

  /** 動いたとき。上に threshold 以上動いた最初の1回だけ true(指を離すのを待たない) */
  move(y: number): boolean {
    if (this.startY === null || this.fired) return false;
    if (this.startY - y >= this.threshold) {
      this.fired = true;
      return true;
    }
    return false;
  }

  end(): void {
    this.startY = null;
    this.fired = false;
  }
}

// 時間などのパラメータを、ここ1か所にまとめる(docs/mvp/spec.md 8節)。値は試遊で調整する。
// core はこの数字を使って時間を数えない。数えるのは画面側(apps/web)のタイマー。

/** 最小値と最大値(ミリ秒)。この間のランダムな値を使う */
export type Range = readonly [min: number, max: number];

export interface Params {
  /** 開始時の受付の長さ */
  readonly START_WINDOW_MS: number;
  /** 初張りのあと、最低限残す時間 */
  readonly FIRST_ARM_GRACE_MS: number;
  /** CPUが初張りするまで */
  readonly CPU_FIRST_ARM_DELAY_MS: Range;
  /** ①ターン開始の表示 */
  readonly TURN_START_MS: number;
  /** CPUが操作するまで */
  readonly CPU_THINK_MS: Range;
  /** プレイのあとの④の長さ(ドボン受付の最低時間) */
  readonly ACCEPT_MIN_MS: number;
  /** パスのあとの④の長さ */
  readonly PASS_PAUSE_MS: number;
  /** CPUがドボンを宣言するまで */
  readonly CPU_DOBON_REACTION_MS: Range;
  /** 猶予 */
  readonly GRACE_MS: number;
  /** 継続のテロップ */
  readonly STILL_ARMED_TOAST_MS: number;
  /** 「ドボン!」の表示 */
  readonly RESULT_FLASH_MS: number;
}

export const DEFAULT_PARAMS: Params = {
  START_WINDOW_MS: 4000,
  FIRST_ARM_GRACE_MS: 1500,
  CPU_FIRST_ARM_DELAY_MS: [600, 1500],
  TURN_START_MS: 400,
  CPU_THINK_MS: [700, 1200],
  ACCEPT_MIN_MS: 2500,
  PASS_PAUSE_MS: 600,
  CPU_DOBON_REACTION_MS: [400, 1200],
  GRACE_MS: 1000,
  STILL_ARMED_TOAST_MS: 1000,
  RESULT_FLASH_MS: 1800,
};

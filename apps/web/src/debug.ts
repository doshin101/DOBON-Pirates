// デバッグ設定(spec 10節)。URLの ?debug=1 ?seed=123 ?speed=2 と、ホームの設定で決める。

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface Settings {
  /** デバッグ表示:CPUの手札の表、ログを最初から開く、結果にシード */
  readonly debug: boolean;
  /** 配りの元(シード)。null ならランダム。決めると、同じ展開を再現できる */
  readonly seed: number | null;
  /** 進行の速さ。すべての時間をこの倍率で割る */
  readonly speed: Speed;
}

export const DEFAULT_SETTINGS: Settings = { debug: false, seed: null, speed: 1 };

const MAX_SEED = 0x7fffffff;

/** シードの文字を、整数にする。空・数字でない・大きすぎるときは null */
export function parseSeed(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) && value <= MAX_SEED ? value : null;
}

export function parseSpeed(text: string | null | undefined): Speed {
  const value = Number(text);
  return (SPEEDS as readonly number[]).includes(value) ? (value as Speed) : 1;
}

/** URL の「?」以降の文字から、設定を読む */
export function parseSettings(search: string): Settings {
  const params = new URLSearchParams(search);
  const debug = params.get('debug');
  return {
    debug: debug !== null && debug !== '0' && debug !== 'false',
    seed: parseSeed(params.get('seed')),
    speed: parseSpeed(params.get('speed')),
  };
}

/** 対戦ごとのシード。決めてあればそれ、なければランダム(画面側なので Math.random を使ってよい) */
export function pickSeed(settings: Settings): number {
  return settings.seed ?? Math.floor(Math.random() * MAX_SEED);
}

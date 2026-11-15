/** シード付きの乱数。同じシードなら、同じ順番で同じ値が出る */
export interface Rng {
  /** 0以上1未満 */
  next(): number;
  /** 0以上 maxExclusive 未満の整数 */
  nextInt(maxExclusive: number): number;
}

/** mulberry32(小さくて速い、シード付きの乱数) */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, nextInt: (maxExclusive) => Math.floor(next() * maxExclusive) };
}

/** 新しい並びを返す(元の配列は変えない)。フィッシャー–イェーツ法 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    const tmp = result[i] as T;
    result[i] = result[j] as T;
    result[j] = tmp;
  }
  return result;
}

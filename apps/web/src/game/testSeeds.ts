import type { PolicyName } from './policies';

/**
 * 4つの終わり方を再現できるシード(docs/mvp/test-seeds.md)。
 * `?seed=113` のように URL に付けて、同じ方針(policies.ts)で操作すると、同じ結果になる。
 */
export const TEST_SEEDS = {
  /** あなたがドボンして勝つ */
  win: { seed: 113, policy: 'standard' as PolicyName },
  /** ドボンされて負ける(あなたが出したカードに、CPUがドボンする) */
  lose: { seed: 386, policy: 'standard' as PolicyName },
  /** チョンボで負ける(合計が合わないのにドボンする) */
  foul: { seed: 26, policy: 'reckless' as PolicyName },
  /** 引き分け(山札がなくなる。長い) */
  draw: { seed: 1473, policy: 'standard' as PolicyName },
} as const;

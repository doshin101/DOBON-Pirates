import { describe, expect, it } from 'vitest';
import { playWithPolicy } from './policies';
import { TEST_SEEDS } from './testSeeds';

// docs/mvp/test-seeds.md に書いたシードが、本当にその結果になることを守るテスト。
// 速さ(×1 ×2 ×4)を変えても、同じ結果になること。

describe.each([1, 2, 4] as const)('テスト用のシード(速さ ×%i)', (speed) => {
  it('win:あなたがドボンして勝つ。敗者は、そのカードをプレイした人', () => {
    const game = playWithPolicy(TEST_SEEDS.win.seed, TEST_SEEDS.win.policy, speed);
    expect(game.result).toEqual({ type: 'dobon', winner: 0, loser: 3 });
    expect(game.cpuDeclared).toBe(false);
  });

  it('lose:あなたが出したカードに、CPUがドボンして、あなたが負ける', () => {
    const game = playWithPolicy(TEST_SEEDS.lose.seed, TEST_SEEDS.lose.policy, speed);
    expect(game.result).toEqual({ type: 'dobon', winner: 3, loser: 0 });
  });

  it('foul:合計が合わないのにドボンして、チョンボで負ける(勝者なし)', () => {
    const game = playWithPolicy(TEST_SEEDS.foul.seed, TEST_SEEDS.foul.policy, speed);
    expect(game.result).toEqual({ type: 'foul', losers: [0] });
    expect(game.cpuDeclared).toBe(false);
  });

  it('draw:山札がなくなって、引き分け', () => {
    const game = playWithPolicy(TEST_SEEDS.draw.seed, TEST_SEEDS.draw.policy, speed);
    expect(game.result).toEqual({ type: 'noContest' });
    expect(game.turns).toBeGreaterThan(40);
  });
});

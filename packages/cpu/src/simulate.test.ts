import { describe, expect, it } from 'vitest';
import { simulateGame } from './simulate';

describe('T-22 同じシードなら、CPUだけの対戦が同じ展開になる', () => {
  it.each([1, 2, 42, 2024])('シード %i:結果・ターン数・起きたこと が完全に同じ', (seed) => {
    const a = simulateGame(seed, { recordEvents: true });
    const b = simulateGame(seed, { recordEvents: true });
    expect(b.result).toEqual(a.result);
    expect(b.turns).toBe(a.turns);
    expect(b.events).toEqual(a.events);
    expect(b.finalState).toEqual(a.finalState);
  });
  it('違うシードなら、(たいてい)違う展開になる', () => {
    const logs = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      logs.add(JSON.stringify(simulateGame(seed, { recordEvents: true }).events));
    }
    expect(logs.size).toBeGreaterThan(5);
  });
});

describe('T-23 CPUだけで1000ゲーム回しても、エラーや止まりが起きない', () => {
  it('必ずドボン・チョンボ・引き分けのどれかで終わる', () => {
    const counts = { dobon: 0, foul: 0, noContest: 0 };
    for (let seed = 1; seed <= 1000; seed++) {
      const game = simulateGame(seed, { maxSteps: 500 }); // 止まったり、受け付けられない操作があれば例外
      expect(['dobon', 'foul', 'noContest']).toContain(game.result.type);
      expect(game.finalState.phase).toBe('finished');
      counts[game.result.type]++;
    }
    expect(counts.dobon + counts.foul + counts.noContest).toBe(1000);
    // CPUはチョンボしない
    expect(counts.foul).toBe(0);
  });

  it('ドボンの勝者は、必ず張っていて合計が場札と一致している(ルールの整合)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const game = simulateGame(seed);
      if (game.result.type !== 'dobon') continue;
      const { winner, loser } = game.result;
      const total = game.finalState.hands[winner].reduce((sum, card) => sum + card.rank, 0);
      expect(total).toBe(game.finalState.topCard.rank);
      expect(game.finalState.armed[winner]).toBe(true);
      expect(game.finalState.topCardPlayedBy).toBe(loser);
      expect(winner).not.toBe(loser);
    }
  });
});

import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '@dobon/core';
import { sortHand } from './sortHand';

const c = (suit: Suit, rank: Rank): Card => ({ suit, rank });

describe('手札の並び(spec 4-5)', () => {
  it('左からダイヤ → ハート → クラブ → スペード、各マークの中は数字の昇順', () => {
    const sorted = sortHand([c('S', 2), c('D', 9), c('H', 1), c('D', 3), c('C', 13), c('S', 1), c('H', 12)]);
    expect(sorted).toEqual([
      c('D', 3),
      c('D', 9),
      c('H', 1),
      c('H', 12),
      c('C', 13),
      c('S', 1),
      c('S', 2),
    ]);
  });
  it('元の配列は変えない', () => {
    const hand = [c('S', 2), c('D', 9)];
    sortHand(hand);
    expect(hand).toEqual([c('S', 2), c('D', 9)]);
  });
});

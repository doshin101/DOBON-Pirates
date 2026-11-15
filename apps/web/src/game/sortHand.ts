import type { Card, Suit } from '@dobon/core';

/** 左から:ダイヤ → ハート → クラブ → スペード(右端がスペード)。各マークの中は数字の昇順(spec 4-5) */
const SUIT_ORDER: Record<Suit, number> = { D: 0, H: 1, C: 2, S: 3 };

export function sortHand(hand: readonly Card[]): Card[] {
  return [...hand].sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || a.rank - b.rank);
}

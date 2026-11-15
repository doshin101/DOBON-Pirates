import type { Card, Rank, Suit } from './types';

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

/** 52枚のトランプ(ジョーカーなし)を、決まった順で作る */
export function createDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/** 手札の合計(handTotal) */
export function handTotal(hand: readonly Card[]): number {
  return hand.reduce((sum, card) => sum + card.rank, 0);
}

/** 出せるカード = 場札と同じ数字か同じマーク */
export function isPlayable(card: Card, topCard: Card): boolean {
  return card.rank === topCard.rank || card.suit === topCard.suit;
}

export function playableCards(hand: readonly Card[], topCard: Card): Card[] {
  return hand.filter((card) => isPlayable(card, topCard));
}

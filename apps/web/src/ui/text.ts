import { format, type Messages } from '@dobon/i18n';
import type { ActionErrorCode, Card, GameEvent, PlayerId } from '@dobon/core';

const PLAYER_KEYS = ['you', 'cpu1', 'cpu2', 'cpu3'] as const;

export function playerName(m: Messages, player: PlayerId): string {
  return m.players[PLAYER_KEYS[player]];
}

/** 「♠8」のようなカードの文字 */
export function cardLabel(m: Messages, card: Card): string {
  return `${m.cards.suits[card.suit]}${m.cards.ranks[card.rank]}`;
}

export type ButtonKind = 'play' | 'draw' | 'pass' | 'arm';

/** 押せない理由の文字(理由がない・文字がないときは空) */
export function reasonText(m: Messages, code: ActionErrorCode | null, button: ButtonKind): string {
  switch (code) {
    case 'notYourTurn':
      return button === 'arm' ? m.reasons.armOnlyOwnTurn : m.reasons.notYourTurn;
    case 'mustDrawFirst':
    case 'noPlayableCard':
    case 'hasPlayableCard':
    case 'alreadyDrew':
    case 'drawFirst':
    case 'totalTooHigh':
    case 'alreadyArmed':
    case 'resolutionPending':
      return m.reasons[code];
    default:
      return '';
  }
}

/** ログ1行の文字。ログに出さないできごとは null。他の人がドローしたカードは見せない */
export function logText(m: Messages, event: GameEvent): string | null {
  switch (event.type) {
    case 'gameStarted':
      return format(m.log.gameStarted, { name: playerName(m, event.startingPlayer) });
    case 'played':
      return format(m.log.played, {
        name: playerName(m, event.player),
        card: cardLabel(m, event.card),
      });
    case 'drew':
      return event.player === 0
        ? format(m.log.drewOwn, { name: playerName(m, event.player), card: cardLabel(m, event.card) })
        : format(m.log.drew, { name: playerName(m, event.player) });
    case 'passed':
      return format(m.log.passed, { name: playerName(m, event.player) });
    default:
      return null;
  }
}

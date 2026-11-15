import { format, type Messages } from '@dobon/i18n';
import { handTotal, type ActionErrorCode, type Card, type GameEvent, type GameResult, type GameState, type PlayerId } from '@dobon/core';
import type { Toast } from '../game/GameRunner';

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
    case 'armed':
      return format(m.log.armed, { name: playerName(m, event.player) });
    case 'armFailed':
      return format(m.log.armFailed, { name: playerName(m, event.player), total: event.handTotal });
    case 'disarmed':
      return format(m.log.disarmed, { name: playerName(m, event.player) });
    case 'dobonDeclared':
      // 判定までは、誰が宣言したかを他の人に見せない(自分の宣言だけ出す)
      return event.player === 0
        ? format(m.log.dobonDeclaredYou, { name: playerName(m, event.player) })
        : null;
    default:
      return null;
  }
}

/** 終了のログ。盤面(場札・合計)が要るので、状態から作る */
export function endLogText(m: Messages, state: GameState): string | null {
  const result = state.result;
  if (!result) return null;
  switch (result.type) {
    case 'dobon':
      return format(m.log.endedDobon, {
        winner: playerName(m, result.winner),
        loser: playerName(m, result.loser),
        card: cardLabel(m, state.topCard),
        total: handTotal(state.hands[result.winner]),
      });
    case 'foul':
      return format(m.log.endedFoul, { names: joinNames(m, result.losers) });
    case 'noContest':
      return m.log.endedNoContest;
  }
}

export function joinNames(m: Messages, players: readonly PlayerId[]): string {
  return players.map((p) => playerName(m, p)).join(m.result.nameSeparator);
}

/** 知らせ(トースト)の文字 */
export function toastText(m: Messages, toast: Toast): string {
  const name = playerName(m, toast.player);
  switch (toast.kind) {
    case 'armed':
      return toast.player === 0 ? m.toast.armedYou : format(m.toast.armed, { name });
    case 'armFailed':
      return format(m.toast.armFailed, { total: toast.total ?? 0 });
    case 'disarmed':
      return format(m.toast.disarmed, { name });
    case 'stillArmed':
      return format(m.toast.stillArmed, { name });
  }
}

export interface ResultTexts {
  readonly title: string;
  readonly detail: string;
}

/** 結果画面(と、「ドボン!」の表示)の文字 */
export function resultTexts(m: Messages, state: GameState, result: GameResult): ResultTexts {
  switch (result.type) {
    case 'dobon':
      return {
        title: m.result.dobon,
        detail: format(m.result.dobonDetail, {
          loser: playerName(m, result.loser),
          card: cardLabel(m, state.topCard),
          winner: playerName(m, result.winner),
          total: handTotal(state.hands[result.winner]),
        }),
      };
    case 'foul':
      return {
        title: m.result.foul,
        detail: format(m.result.foulDetail, { names: joinNames(m, result.losers) }),
      };
    case 'noContest':
      return { title: m.result.noContest, detail: m.result.noContestDetail };
  }
}

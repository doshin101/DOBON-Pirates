import { format, getMessages } from '@dobon/i18n';
import type { GameResult, GameState } from '@dobon/core';
import { joinNames, playerName, resultTexts } from '../ui/text';

/** 判定が出たときに、画面の中央に大きく出す「ドボン!」「チョンボ!」と名前(spec 6-3) */
export function ResultFlash({ state, result }: { state: GameState; result: GameResult }) {
  const m = getMessages();
  const { title, detail } = resultTexts(m, state, result);
  const line =
    result.type === 'dobon'
      ? format(m.flash.winner, { name: playerName(m, result.winner) })
      : result.type === 'foul'
        ? format(m.flash.losers, { names: joinNames(m, result.losers) })
        : '';
  return (
    <div className="overlay" role="alert">
      <div className="overlay__title">{title}</div>
      {line && <div className="overlay__line">{line}</div>}
      <div className="overlay__detail">{detail}</div>
    </div>
  );
}

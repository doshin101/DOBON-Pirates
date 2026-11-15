import { handTotal, PLAYER_IDS, type GameResult, type GameState, type PlayerId } from '@dobon/core';
import { format, getMessages } from '@dobon/i18n';
import { CardFace } from '../components/CardFace';
import { sortHand } from '../game/sortHand';
import { playerName, resultTexts } from '../ui/text';

interface Props {
  state: GameState;
  result: GameResult;
  onAgain: () => void;
  onHome: () => void;
}

type Role = 'winner' | 'loser' | 'none';

function roleOf(result: GameResult, player: PlayerId): Role {
  switch (result.type) {
    case 'dobon':
      return player === result.winner ? 'winner' : player === result.loser ? 'loser' : 'none';
    case 'foul':
      return result.losers.includes(player) ? 'loser' : 'none';
    case 'noContest':
      return 'none';
  }
}

/** 結果画面。勝者・敗者・どちらでもない(順位はつけない)、最後の場札、全員の手札と合計(答え合わせ) */
export function ResultScreen({ state, result, onAgain, onHome }: Props) {
  const m = getMessages();
  const { title, detail } = resultTexts(m, state, result);
  return (
    <div className="result">
      <header className="topbar topbar--result">
        <span />
        <span>{m.game.resultTitle}</span>
        <span />
      </header>
      <div className="result__body">
        <div className="result__head">
          <div className="result__title">{title}</div>
          <div className="result__detail">{detail}</div>
        </div>
        <div className="result__top">
          <CardFace card={state.topCard} big />
        </div>
        {PLAYER_IDS.map((player) => {
          const role = roleOf(result, player);
          return (
            <div className="row" key={player}>
              <span className={`row__tag${role === 'winner' ? ' row__tag--win' : ''}`}>
                {role === 'winner' ? m.result.winner : role === 'loser' ? m.result.loser : m.result.none}
              </span>
              <span className="row__name">{playerName(m, player)}</span>
              <span className="row__hand">
                {sortHand(state.hands[player]).map((card) => (
                  <CardFace key={`${card.suit}${card.rank}`} card={card} mini />
                ))}
              </span>
              <span className="row__sum">{format(m.result.total, { total: handTotal(state.hands[player]) })}</span>
            </div>
          );
        })}
        <button type="button" className="btn btn--primary" onClick={onAgain}>
          {m.result.again}
        </button>
        <button type="button" className="btn" onClick={onHome}>
          {m.result.toHome}
        </button>
      </div>
    </div>
  );
}

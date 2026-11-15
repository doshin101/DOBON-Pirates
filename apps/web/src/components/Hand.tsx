import type { Card } from '@dobon/core';
import type { CardState } from '../game/controls';
import { CardFace } from './CardFace';

interface Props {
  hand: readonly Card[];
  states: readonly CardState[];
  onToggle: (card: Card) => void;
}

/**
 * 自分の手札。枚数が増えると、重なりが自動で詰まる(8枚までは広め、9〜14枚は詰める、
 * 15枚以上は横スクロール)。重なり方は style.css の .hand__slot で決めている。
 */
export function Hand({ hand, states, onToggle }: Props) {
  return (
    <div className="hand">
      <div className="hand__row">
        {hand.map((card, i) => {
          const state = states[i] ?? 'unplayable';
          const tappable = state === 'selectable' || state === 'selected';
          return (
            <button
              key={`${card.suit}${card.rank}`}
              type="button"
              className={`hand__slot hand__slot--${state}`}
              disabled={!tappable}
              aria-pressed={state === 'selected'}
              onClick={() => onToggle(card)}
            >
              <CardFace card={card} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

import type { PlayerId } from '@dobon/core';
import { getMessages } from '@dobon/i18n';
import { playerName } from '../ui/text';
import { CardStack } from './CardFace';

interface Props {
  player: PlayerId;
  count: number;
  armed: boolean;
  isDealer: boolean;
  isTurn: boolean;
  className: string;
}

/** CPUの席(名前、手札の束と枚数、張りバッジ、手番の印) */
export function Seat({ player, count, armed, isDealer, isTurn, className }: Props) {
  const m = getMessages();
  return (
    <div className={`seat ${className}${isTurn ? ' turnmark' : ''}`}>
      <div className="seat__name">
        {playerName(m, player)}
        {isDealer && <span className="seat__dealer">{m.game.dealer}</span>}
        {armed && <span className="badge">{m.game.armedBadge}</span>}
      </div>
      <CardStack count={count} />
    </div>
  );
}

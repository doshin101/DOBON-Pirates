import type { Card } from '@dobon/core';
import { getMessages } from '@dobon/i18n';
import { cardLabel } from '../ui/text';

interface Props {
  card: Card;
  big?: boolean;
  mini?: boolean;
}

/** 表向きのカード1枚 */
export function CardFace({ card, big, mini }: Props) {
  const m = getMessages();
  const size = big ? ' card--big' : mini ? ' card--mini' : '';
  return <div className={`card${size}`}>{cardLabel(m, card)}</div>;
}

/** 裏向きのカードの束と、枚数 */
export function CardStack({ count }: { count?: number }) {
  return (
    <div className="stack" aria-hidden={count === undefined}>
      {count !== undefined && <span className="stack__count">{count}</span>}
    </div>
  );
}

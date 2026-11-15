import { PLAYER_IDS, handTotal, type GameState } from '@dobon/core';
import { format, getMessages } from '@dobon/i18n';
import type { Speed } from '../debug';
import { SpeedButtons } from '../screens/HomeScreen';
import { sortHand } from '../game/sortHand';
import { playerName } from '../ui/text';
import { CardFace } from './CardFace';

interface Props {
  state: GameState;
  seed: number;
  speed: Speed;
  onSpeed: (speed: Speed) => void;
}

/** デバッグ表示:シード、速さの切り替え、CPUの手札の表(開発の確認用。CPUの手札が見えてしまう) */
export function DebugPanel({ state, seed, speed, onSpeed }: Props) {
  const m = getMessages();
  return (
    <div className="debug">
      <div className="debug__head">
        <span>{format(m.game.debugSeed, { seed })}</span>
        <span>
          {m.game.debugSpeed} <SpeedButtons value={speed} onChange={onSpeed} />
        </span>
      </div>
      <table className="debug__table" aria-label={m.game.debugCpuHands}>
        <tbody>
          {PLAYER_IDS.filter((p) => p !== 0).map((player) => (
            <tr key={player}>
              <th scope="row">{playerName(m, player)}</th>
              <td className="debug__cards">
                {sortHand(state.hands[player]).map((card) => (
                  <CardFace key={`${card.suit}${card.rank}`} card={card} mini />
                ))}
              </td>
              <td className="debug__sum">{handTotal(state.hands[player])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

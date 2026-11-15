import { useState } from 'react';
import { sameCard, handTotal, type Card, type PlayerId } from '@dobon/core';
import { format, getMessages } from '@dobon/i18n';
import { CardFace, CardStack } from '../components/CardFace';
import { Hand } from '../components/Hand';
import { LogPanel } from '../components/LogPanel';
import { Seat } from '../components/Seat';
import { getHumanControls, type ButtonState } from '../game/controls';
import { HUMAN } from '../game/GameRunner';
import { sortHand } from '../game/sortHand';
import { useGame } from '../game/useGame';
import { playerName, reasonText, type ButtonKind } from '../ui/text';

interface Props {
  onExit: () => void;
}

/** 配置:CPUは 左(1)・上(2)・右(3)。自分は下 */
const SEATS: { player: PlayerId; className: string }[] = [
  { player: 2, className: 'seat--top' },
  { player: 1, className: 'seat--left' },
  { player: 3, className: 'seat--right' },
];

export function GameScreen({ onExit }: Props) {
  const m = getMessages();
  // 対戦ごとの配りの元(シード)。M4 で ?seed= から指定できるようにする
  const [seed] = useState(() => Math.floor(Math.random() * 0x7fffffff));
  const { runner, snapshot } = useGame(seed);
  const [selected, setSelected] = useState<Card | null>(null);

  const { state, stage } = snapshot;
  const hand = sortHand(state.hands[HUMAN]);
  const controls = getHumanControls(snapshot, hand, selected);
  const holding = selected && hand.some((c) => sameCard(c, selected)) && controls.canAct ? selected : null;
  const myTurn = state.currentPlayer === HUMAN;
  const finished = state.phase === 'finished';

  const toggle = (card: Card) => setSelected(holding && sameCard(holding, card) ? null : card);
  const play = () => {
    if (holding && runner.humanPlay(holding)) setSelected(null);
  };
  const draw = () => {
    runner.humanDraw();
    setSelected(null);
  };
  const pass = () => {
    runner.humanPass();
    setSelected(null);
  };
  const quit = () => {
    if (finished || window.confirm(m.game.confirmQuit)) onExit();
  };

  const turnMessage = finished
    ? ''
    : myTurn
      ? m.game.yourTurn
      : format(m.game.turnOf, { name: playerName(m, state.currentPlayer) });
  const playedBy = state.topCardPlayedBy;

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="topbar__menu" aria-label={m.game.menu} onClick={quit}>
          ≡
        </button>
        <span>{format(m.game.deckCount, { count: state.stock.length })}</span>
        <span>{m.app.title}</span>
      </header>

      <section className="table">
        {SEATS.map(({ player, className }) => (
          <Seat
            key={player}
            player={player}
            className={className}
            count={state.hands[player].length}
            armed={state.armed[player]}
            isDealer={state.startingPlayer === player}
            isTurn={!finished && state.currentPlayer === player}
          />
        ))}
        <div className="center">
          <div className="pile">
            <CardStack />
            <CardFace card={state.topCard} big />
          </div>
          <div className="center__note">
            {playedBy === null
              ? m.game.startingTopCard
              : format(m.game.playedBy, { name: playerName(m, playedBy) })}
          </div>
        </div>
        <div className="msg">{turnMessage}</div>
      </section>

      <section className={`me${myTurn && !finished ? ' turnmark' : ''}`}>
        <div className="me__head">
          <span>
            {playerName(m, HUMAN)}
            {state.startingPlayer === HUMAN && `(${m.game.dealer})`}
            {state.armed[HUMAN] && <span className="badge">{m.game.armedBadge}</span>}
          </span>
          <span className="total">
            {m.game.total} <b>{handTotal(state.hands[HUMAN])}</b>
          </span>
        </div>
        <Hand hand={hand} states={controls.cardStates} onToggle={toggle} />
        <div className="controls">
          <Control kind="play" state={controls.play} primary={controls.play.enabled} onPress={play} />
          <Control kind="draw" state={controls.draw} onPress={draw} />
          <Control kind="pass" state={controls.pass} onPress={pass} />
          {/* M2:張るボタンは表示だけ。押しても何も起きない(M3 で動かす) */}
          <Control kind="arm" state={controls.arm} main onPress={() => {}} />
        </div>
      </section>

      <LogPanel log={snapshot.log} />

      {stage === 'ended' && state.result && (
        <div className="overlay" role="dialog" aria-live="polite">
          <div className="overlay__title">{m.result.noContest}</div>
          <button type="button" className="btn btn--primary" onClick={onExit}>
            {m.result.toHome}
          </button>
        </div>
      )}
    </div>
  );
}

interface ControlProps {
  kind: ButtonKind;
  state: ButtonState;
  onPress: () => void;
  primary?: boolean;
  main?: boolean;
}

/** ボタン1つと、押せない理由(小さく)。押せないボタンは非活性にする */
function Control({ kind, state, onPress, primary, main }: ControlProps) {
  const m = getMessages();
  const reason = state.enabled ? '' : reasonText(m, state.reason, kind);
  const cls = main
    ? `main${state.enabled ? '' : ' main--off'}`
    : `btn${primary ? ' btn--primary' : ''}${state.enabled ? '' : ' btn--off'}`;
  return (
    <div className="control">
      <button type="button" className={cls} disabled={!state.enabled} onClick={onPress}>
        {m.buttons[kind]}
      </button>
      <div className="reason">{reason}</div>
    </div>
  );
}


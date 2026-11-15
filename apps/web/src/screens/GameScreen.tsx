import { useState } from 'react';
import type { Settings, Speed } from '../debug';
import { sameCard, handTotal, type Card, type PlayerId } from '@dobon/core';
import { format, getMessages } from '@dobon/i18n';
import { CardFace, CardStack } from '../components/CardFace';
import { DebugPanel } from '../components/DebugPanel';
import { Hand } from '../components/Hand';
import { LogPanel } from '../components/LogPanel';
import { MainButton } from '../components/MainButton';
import { ResultFlash } from '../components/ResultFlash';
import { Seat } from '../components/Seat';
import { Toasts } from '../components/Toasts';
import { getHumanControls, type ButtonState } from '../game/controls';
import { HUMAN } from '../game/GameRunner';
import { sortHand } from '../game/sortHand';
import { useGame } from '../game/useGame';
import { playerName, reasonText, type ButtonKind } from '../ui/text';
import { ResultScreen } from './ResultScreen';

interface Props {
  /** この対戦の配りの元(シード) */
  seed: number;
  settings: Settings;
  /** ホームへ戻る */
  onExit: () => void;
  /** もう一度(新しい配りで始める) */
  onAgain: () => void;
}

/** 配置:CPUは 左(1)・上(2)・右(3)。自分は下 */
const SEATS: { player: PlayerId; className: string }[] = [
  { player: 2, className: 'seat--top' },
  { player: 1, className: 'seat--left' },
  { player: 3, className: 'seat--right' },
];

export function GameScreen({ seed, settings, onExit, onAgain }: Props) {
  const m = getMessages();
  const { runner, snapshot } = useGame(seed, settings.speed);
  const [selected, setSelected] = useState<Card | null>(null);

  const { state, stage } = snapshot;
  const hand = sortHand(state.hands[HUMAN]);
  const controls = getHumanControls(snapshot, hand, selected);
  const holding = selected && hand.some((c) => sameCard(c, selected)) && controls.canAct ? selected : null;
  const myTurn = state.currentPlayer === HUMAN;
  const finished = state.phase === 'finished';

  if (stage === 'ended' && state.result) {
    return (
      <ResultScreen
        state={state}
        result={state.result}
        seed={settings.debug ? seed : null}
        onAgain={onAgain}
        onHome={onExit}
      />
    );
  }

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

  const message =
    stage === 'startWindow' && snapshot.countdown !== null
      ? format(m.game.countdown, { count: snapshot.countdown })
      : finished
        ? ''
        : myTurn
          ? m.game.yourTurn
          : format(m.game.turnOf, { name: playerName(m, state.currentPlayer) });
  const playedBy = state.topCardPlayedBy;

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" className="topbar__menu" aria-label={m.game.menu} onClick={quit}>
          {m.symbols.menu}
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
            isTurn={!finished && stage !== 'startWindow' && state.currentPlayer === player}
          />
        ))}
        <div className="center">
          <div className="pile">
            <CardStack />
            <div className={state.dobonWindowOpen ? 'window' : undefined}>
              <CardFace card={state.topCard} big />
            </div>
          </div>
          {state.dobonWindowOpen && <div className="window-label">{m.game.dobonWindow}</div>}
          <div className="center__note">
            {playedBy === null
              ? m.game.startingTopCard
              : format(m.game.playedBy, { name: playerName(m, playedBy) })}
          </div>
        </div>
        <div className="msg">{message}</div>
        <Toasts toasts={snapshot.toasts} />
      </section>

      <section className={`me${myTurn && !finished && stage !== 'startWindow' ? ' turnmark' : ''}`}>
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
          <MainButton state={controls.main} onArm={() => runner.humanArm()} onDobon={() => runner.humanDobon()} />
        </div>
      </section>

      {settings.debug && (
        <DebugPanel state={state} seed={seed} speed={snapshot.speed as Speed} onSpeed={(speed) => runner.setSpeed(speed)} />
      )}

      <LogPanel log={snapshot.log} state={state} defaultOpen={settings.debug} />

      {stage === 'flash' && state.result && <ResultFlash state={state} result={state.result} />}
    </div>
  );
}

interface ControlProps {
  kind: ButtonKind;
  state: ButtonState;
  onPress: () => void;
  primary?: boolean;
}

/** ボタン1つと、押せない理由(小さく)。押せないボタンは非活性にする */
function Control({ kind, state, onPress, primary }: ControlProps) {
  const m = getMessages();
  const reason = state.enabled ? '' : reasonText(m, state.reason, kind);
  const cls = `btn${primary ? ' btn--primary' : ''}${state.enabled ? '' : ' btn--off'}`;
  return (
    <div className="control">
      <button type="button" className={cls} disabled={!state.enabled} onClick={onPress}>
        {m.buttons[kind as 'play' | 'draw' | 'pass']}
      </button>
      <div className="reason">{reason}</div>
    </div>
  );
}

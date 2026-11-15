import { useRef } from 'react';
import { getMessages } from '@dobon/i18n';
import type { MainState } from '../game/controls';
import { FlickTracker } from '../game/flick';
import { reasonText } from '../ui/text';

interface Props {
  state: MainState;
  /** 「張る」をタップしたとき */
  onArm: () => void;
  /** ドボンが上にフリックされたとき(指を離すのを待たずに呼ぶ) */
  onDobon: () => void;
}

/**
 * メインボタン(張る / ドボン)。張っていないときは「張る」、張ったあとは「ドボン」に変わる。
 * ドボンは、ボタンに触れた指(マウス)を上に約48px動かした時点で発火する。タップだけでは発火しない。
 */
export function MainButton({ state, onArm, onDobon }: Props) {
  const m = getMessages();
  const tracker = useRef(new FlickTracker());

  if (state.kind === 'arm') {
    return (
      <div className="control">
        <button type="button" className={`main${state.enabled ? '' : ' main--off'}`} disabled={!state.enabled} onClick={onArm}>
          {m.buttons.arm}
          {state.enabled && <small>{m.buttons.armHint}</small>}
        </button>
        <div className="reason">{state.enabled ? '' : reasonText(m, state.reason, 'arm')}</div>
      </div>
    );
  }

  if (state.kind === 'armReserved') {
    return (
      <div className="control">
        <button type="button" className="main main--off" disabled>
          {m.buttons.armReserved}
        </button>
        <div className="reason" />
      </div>
    );
  }

  // ドボン
  const ready = state.mode === 'ready';
  const label =
    state.mode === 'judging'
      ? m.buttons.judging
      : state.mode === 'notTarget'
        ? m.buttons.dobonNotTarget
        : ready
          ? m.buttons.dobon
          : m.buttons.dobonClosed;

  // 受付の時間外(closed)は、グレー表示でフリックしても何も起きない。
  // 対象外(notTarget)と判定待ち(judging)は、操作を受け付けない
  const interactive = ready;
  return (
    <div className="control">
      <button
        type="button"
        className={`main${ready ? ' main--dobon' : ' main--off'}`}
        aria-disabled={!ready}
        disabled={state.mode === 'notTarget' || state.mode === 'judging'}
        onPointerDown={(e) => {
          if (!interactive) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          tracker.current.start(e.clientY);
        }}
        onPointerMove={(e) => {
          if (interactive && tracker.current.move(e.clientY)) onDobon();
        }}
        onPointerUp={() => tracker.current.end()}
        onPointerCancel={() => tracker.current.end()}
      >
        {label}
        {ready && <small>{m.buttons.dobonHint}</small>}
      </button>
      <div className="reason" />
    </div>
  );
}

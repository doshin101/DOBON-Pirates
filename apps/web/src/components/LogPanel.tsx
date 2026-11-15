import { useState } from 'react';
import { getMessages } from '@dobon/i18n';
import type { GameState } from '@dobon/core';
import type { LogEntry } from '../game/GameRunner';
import { endLogText, logText } from '../ui/text';

/** 画面下の、折りたたみのログ(誰が何をしたか。開発の確認用) */
export function LogPanel({
  log,
  state,
  defaultOpen = false,
}: {
  log: readonly LogEntry[];
  state: GameState;
  /** デバッグ表示のときは、最初から開いておく */
  defaultOpen?: boolean;
}) {
  const m = getMessages();
  const [open, setOpen] = useState(defaultOpen);
  const lines = log.flatMap((entry) => {
    const text = logText(m, entry.event);
    return text === null ? [] : [{ id: entry.id, text }];
  });
  // ゲームが終わったら、結果を最後の行に足す(宣言した人は、ここで初めて分かる)
  const ending = endLogText(m, state);
  if (ending) lines.push({ id: -1, text: ending });
  const last = lines.at(-1)?.text ?? m.log.empty;

  return (
    <div className="log">
      <button type="button" className="log__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{open ? m.symbols.logOpen : m.symbols.logClosed}</span> {m.log.title}
        {!open && `:${last}`}
      </button>
      {open && (
        <ol className="log__list">
          {[...lines].reverse().map((line) => (
            <li key={line.id}>{line.text}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

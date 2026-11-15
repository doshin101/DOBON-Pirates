import { useState } from 'react';
import { getMessages } from '@dobon/i18n';
import type { LogEntry } from '../game/GameRunner';
import { logText } from '../ui/text';

/** 画面下の、折りたたみのログ(誰が何をしたか。開発の確認用) */
export function LogPanel({ log }: { log: readonly LogEntry[] }) {
  const m = getMessages();
  const [open, setOpen] = useState(false);
  const lines = log.flatMap((entry) => {
    const text = logText(m, entry.event);
    return text === null ? [] : [{ id: entry.id, text }];
  });
  const last = lines.at(-1)?.text ?? m.log.empty;

  return (
    <div className="log">
      <button type="button" className="log__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{open ? '▼' : '▲'}</span> {m.log.title}
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

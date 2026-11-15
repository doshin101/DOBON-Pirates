import { getMessages } from '@dobon/i18n';

/** ホームの「ルール」:ミニマムルールの要約(文字は言語ファイル経由) */
export function RulesScreen({ onBack }: { onBack: () => void }) {
  const m = getMessages();
  return (
    <div className="rules">
      <header className="topbar topbar--rules">
        <button type="button" className="topbar__menu rules__back" onClick={onBack}>
          {m.rules.back}
        </button>
        <span>{m.rules.title}</span>
        <span />
      </header>
      <div className="rules__body">
        {m.rules.sections.map((section) => (
          <section key={section.heading} className="rules__section">
            <h2>{section.heading}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

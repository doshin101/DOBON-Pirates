import { format, getMessages } from '@dobon/i18n';
import { SPEEDS, parseSeed, type Settings, type Speed } from '../debug';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onPlay: () => void;
  onRules: () => void;
}

export function HomeScreen({ settings, onChange, onPlay, onRules }: Props) {
  const m = getMessages();
  return (
    <main className="home">
      <h1 className="home__title">{m.app.title}</h1>
      <button type="button" className="btn btn--primary home__button" onClick={onPlay}>
        {m.home.playVsCpu}
      </button>
      <button type="button" className="btn home__button" onClick={onRules}>
        {m.home.rules}
      </button>

      {/* デバッグの設定(小さく)。?debug=1 のときは最初から開いている */}
      <details className="debug-settings" open={settings.debug}>
        <summary>{m.home.debug.title}</summary>
        <label className="debug-settings__row">
          <span>{m.home.debug.seed}</span>
          <input
            type="text"
            inputMode="numeric"
            placeholder={m.home.debug.seedPlaceholder}
            defaultValue={settings.seed ?? ''}
            onChange={(e) => onChange({ ...settings, seed: parseSeed(e.target.value) })}
          />
        </label>
        <div className="debug-settings__row">
          <span>{m.home.debug.speed}</span>
          <SpeedButtons value={settings.speed} onChange={(speed) => onChange({ ...settings, speed })} />
        </div>
        <label className="debug-settings__row debug-settings__row--check">
          <input
            type="checkbox"
            checked={settings.debug}
            onChange={(e) => onChange({ ...settings, debug: e.target.checked })}
          />
          <span>{m.home.debug.debugMode}</span>
        </label>
      </details>
    </main>
  );
}

/** 速さ ×1 ×2 ×4 の切り替え */
export function SpeedButtons({ value, onChange }: { value: Speed; onChange: (speed: Speed) => void }) {
  const m = getMessages();
  return (
    <span className="speed" role="group">
      {SPEEDS.map((speed) => (
        <button
          key={speed}
          type="button"
          className={`speed__btn${speed === value ? ' speed__btn--on' : ''}`}
          aria-pressed={speed === value}
          onClick={() => onChange(speed)}
        >
          {format(m.home.debug.speedValue, { speed })}
        </button>
      ))}
    </span>
  );
}

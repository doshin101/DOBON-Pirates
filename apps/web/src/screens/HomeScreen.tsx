import { getMessages } from '@dobon/i18n';

export function HomeScreen({ onPlay }: { onPlay: () => void }) {
  const m = getMessages();
  return (
    <main className="home">
      <h1 className="home__title">{m.app.title}</h1>
      <button type="button" className="btn btn--primary home__button" onClick={onPlay}>
        {m.home.playVsCpu}
      </button>
    </main>
  );
}

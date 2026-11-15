import { getMessages } from '@dobon/i18n';

export function App() {
  const m = getMessages();
  return (
    <main className="home">
      <h1 className="home__title">{m.app.title}</h1>
      {/* M0:押しても何も起きない */}
      <button type="button" className="home__button">
        {m.home.playVsCpu}
      </button>
    </main>
  );
}

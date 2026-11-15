import { useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';

type Screen = 'home' | 'game';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  // 「ホームへ」→「CPUと対戦」のたびに、新しい対戦(新しい配り)にするため、key で作り直す
  const [round, setRound] = useState(0);
  return screen === 'home' ? (
    <HomeScreen
      onPlay={() => {
        setRound((n) => n + 1);
        setScreen('game');
      }}
    />
  ) : (
    <GameScreen
      key={round}
      onExit={() => setScreen('home')}
      onAgain={() => setRound((n) => n + 1)}
    />
  );
}

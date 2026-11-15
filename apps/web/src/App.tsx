import { useState } from 'react';
import { DEFAULT_SETTINGS, parseSettings, pickSeed, type Settings } from './debug';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RulesScreen } from './screens/RulesScreen';

type Screen = 'home' | 'rules' | 'game';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  // デバッグ設定:URL(?debug=1 ?seed=123 ?speed=2)で最初の値を決め、ホームの設定で変えられる
  const [settings, setSettings] = useState<Settings>(() =>
    typeof window === 'undefined' ? DEFAULT_SETTINGS : parseSettings(window.location.search),
  );
  // 「CPUと対戦」「もう一度」のたびに、新しい対戦にするため、round と seed を作り直す
  // (シードを決めてあるときは、毎回同じ配りになる)
  const [round, setRound] = useState(0);
  const [seed, setSeed] = useState(0);

  const startGame = () => {
    setSeed(pickSeed(settings));
    setRound((n) => n + 1);
    setScreen('game');
  };

  if (screen === 'rules') return <RulesScreen onBack={() => setScreen('home')} />;
  if (screen === 'game') {
    return (
      <GameScreen
        key={round}
        seed={seed}
        settings={settings}
        onExit={() => setScreen('home')}
        onAgain={startGame}
      />
    );
  }
  return (
    <HomeScreen
      settings={settings}
      onChange={setSettings}
      onPlay={startGame}
      onRules={() => setScreen('rules')}
    />
  );
}

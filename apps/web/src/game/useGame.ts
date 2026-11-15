import { useEffect, useState, useSyncExternalStore } from 'react';
import { GameRunner, type Snapshot } from './GameRunner';

/** 画面から GameRunner を使うための道具。画面を閉じたらタイマーも止める */
export function useGame(seed: number, speed = 1): { runner: GameRunner; snapshot: Snapshot } {
  const [runner] = useState(() => new GameRunner({ seed, speed }));
  useEffect(() => {
    runner.start();
    return () => runner.stop();
  }, [runner]);
  const snapshot = useSyncExternalStore(runner.subscribe, runner.getSnapshot);
  return { runner, snapshot };
}

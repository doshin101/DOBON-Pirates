// 4つの終わり方を再現できるシードを探す。使い方:npx vite-node apps/web/scripts/find-test-seeds.ts
import { playWithPolicy, type PolicyGame } from '../src/game/policies';

const HUMAN = 0;
const found: Record<string, PolicyGame[]> = { win: [], lose: [], foul: [], draw: [] };

for (let seed = 1; seed <= 3000; seed++) {
  const standard = playWithPolicy(seed, 'standard');
  const r = standard.result;
  if (r.type === 'dobon' && r.winner === HUMAN && !standard.cpuDeclared) found.win!.push(standard);
  if (r.type === 'dobon' && r.loser === HUMAN) found.lose!.push(standard);
  if (r.type === 'noContest') found.draw!.push(standard);
  const reckless = playWithPolicy(seed, 'reckless');
  const f = reckless.result;
  if (f.type === 'foul' && f.losers.length === 1 && f.losers[0] === HUMAN && !reckless.cpuDeclared) found.foul!.push(reckless);
}
for (const [name, games] of Object.entries(found)) {
  const best = [...games].sort((a, b) => a.turns - b.turns).slice(0, 6);
  console.log(name, '候補', games.length, '件。ターンが短い順:', best.map((g) => `${g.seed}(${g.turns}ターン)`).join(', '));
}

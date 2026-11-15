// シードの展開を、文章で書き出す。使い方:npx vite-node apps/web/scripts/explain-seed.ts <policy> <seed...>
import { createGame, createRng, handTotal } from '@dobon/core';
import { getMessages } from '@dobon/i18n';
import { playWithPolicy, type PolicyName } from '../src/game/policies';
import { cardLabel, logText, playerName, endLogText } from '../src/ui/text';

const m = getMessages();
const [policy, ...seeds] = process.argv.slice(2) as [PolicyName, ...string[]];
for (const seed of seeds.map(Number)) {
  const dealt = createGame(createRng(seed)).state;
  const game = playWithPolicy(seed, policy);
  const hands = [0, 1, 2, 3].map((p) => `${playerName(m, p as 0)}[${dealt.hands[p as 0].map((c) => cardLabel(m, c)).join(' ')}]=${handTotal(dealt.hands[p as 0])}`);
  console.log(`\n=== シード ${seed} / ${policy} / ${game.turns}ターン ===`);
  console.log('親:', playerName(m, dealt.startingPlayer), '/ 最初の場札:', cardLabel(m, dealt.topCard));
  console.log('配り:', hands.join('  '));
  for (const e of game.events) {
    const t = logText(m, e);
    if (t) console.log('  ', t);
    if (e.type === 'dobonDeclared' && e.player !== 0) console.log('   (CPU', e.player, 'がドボンを宣言)');
    if (e.type === 'gameEnded') console.log('   →', JSON.stringify(e.result));
  }
}
void endLogText;

// CPUだけで N ゲーム回して、結果を docs/research/sim-minimum-001.md にまとめる。
// 使い方:npm run sim
import { writeFileSync } from 'node:fs';
import { simulateGame } from '../src/simulate';

const GAMES = 1000;
const OUTPUT = new URL('../../../docs/research/sim-minimum-001.md', import.meta.url);

const results = Array.from({ length: GAMES }, (_, i) => simulateGame(i + 1, { recordEvents: true }));

const count = (pred: (r: (typeof results)[number]) => boolean): number => results.filter(pred).length;
const pct = (n: number): string => `${((n / GAMES) * 100).toFixed(1)}%`;
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const dist = (xs: number[]): string => {
  const sorted = [...xs].sort((a, b) => a - b);
  const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] as number;
  return `最小 ${sorted[0]} / 中央値 ${at(0.5)} / 90% ${at(0.9)} / 最大 ${sorted[sorted.length - 1]}`;
};

const dobon = results.filter((r) => r.result.type === 'dobon');
const foul = count((r) => r.result.type === 'foul');
const noContest = results.filter((r) => r.result.type === 'noContest');
const turns = results.map((r) => r.turns);
const maxHands = results.map((r) => r.maxHandSize);

const winnerSeat = [0, 0, 0, 0];
const loserSeat = [0, 0, 0, 0];
for (const r of dobon) {
  if (r.result.type === 'dobon') {
    winnerSeat[r.result.winner]++;
    loserSeat[r.result.loser]++;
  }
}

const firstArmGames = count((r) => r.events.some((e) => e.type === 'armed' && e.source === 'first'));
const firstArms = results.flatMap((r) => r.events.filter((e) => e.type === 'armed' && e.source === 'first'));
const disarms = results.flatMap((r) => r.events.filter((e) => e.type === 'disarmed'));
const stillArmed = results.flatMap((r) => r.events.filter((e) => e.type === 'stillArmed'));
const dobonTurns = dobon.map((r) => r.turns);
const noContestTurns = noContest.map((r) => r.turns);

const maxHandHistogram = new Map<number, number>();
for (const m of maxHands) maxHandHistogram.set(m, (maxHandHistogram.get(m) ?? 0) + 1);
const histogramRows = [...maxHandHistogram.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([size, n]) => `| ${size}枚 | ${n} | ${pct(n)} |`)
  .join('\n');

const seatName = ['0(自分の席)', '1(左)', '2(上)', '3(右)'];
const seatRows = seatName
  .map((name, i) => `| ${name} | ${winnerSeat[i]} | ${loserSeat[i]} |`)
  .join('\n');

const md = `# シミュレーション結果:ミニマムルール(CPU4人・${GAMES}ゲーム)

> \`npm run sim\` で、同じ結果を作り直せます(シード 1〜${GAMES})。CPUの考えは \`docs/mvp/spec.md\` 7節のとおり(出せるカードはランダム、張れるなら必ず張る、ドボンできるなら必ずドボン、チョンボはしない)。
> 時間(待ち時間・受付の長さ)は扱っていません。順番だけを再現しています。

## 1. 終わり方

| 終わり方 | ゲーム数 | 割合 |
|---|---|---|
| ドボン | ${dobon.length} | ${pct(dobon.length)} |
| チョンボ | ${foul} | ${pct(foul)} |
| 引き分け(山札なし) | ${noContest.length} | ${pct(noContest.length)} |
| 合計 | ${GAMES} | 100% |

- チョンボは、CPUが「合計が合うときだけドボンする」ので、0になります(人間がミスしたときだけ起きます)
- 全ゲームが、エラーも止まりもなく終わりました

## 2. ゲームの長さ

| 項目 | 値 |
|---|---|
| 1ゲームの平均ターン数(全体) | ${avg(turns).toFixed(1)} |
| 分布(全体) | ${dist(turns)} |
| ドボンで終わったゲームの平均ターン数 | ${dobonTurns.length ? avg(dobonTurns).toFixed(1) : '—'} |
| 引き分けで終わったゲームの平均ターン数 | ${noContestTurns.length ? avg(noContestTurns).toFixed(1) : '—'} |

- ターン数は、始まったターンの数です(1周 = 4ターン)

## 3. 手札の最大枚数(ゲーム中に、誰かが持った最大)

| 項目 | 値 |
|---|---|
| 全ゲームでの最大 | ${Math.max(...maxHands)}枚 |
| 1ゲームごとの最大の平均 | ${avg(maxHands).toFixed(1)}枚 |
| 分布 | ${dist(maxHands)} |

| 最大枚数 | ゲーム数 | 割合 |
|---|---|---|
${histogramRows}

- 画面の手札は「8枚までは広め、9〜14枚は自動で詰める、15枚以上は横スクロール」の想定です(spec.md 4-5)

## 4. 張りまわり

| 項目 | 値 |
|---|---|
| 初張りが1人以上いたゲーム | ${firstArmGames} / ${GAMES}(${pct(firstArmGames)}) |
| 1ゲームあたりの初張りの人数(平均) | ${(firstArms.length / GAMES).toFixed(2)} |
| 自動解除(合計14以上)が起きた回数 | ${disarms.length}(1ゲームあたり ${(disarms.length / GAMES).toFixed(2)}) |
| 継続(still armed)が起きた回数 | ${stillArmed.length}(1ゲームあたり ${(stillArmed.length / GAMES).toFixed(2)}) |

## 5. 席ごとの勝ち・負け(ドボンで終わった ${dobon.length} ゲームのうち)

| 席 | 勝者になった回数 | 敗者になった回数 |
|---|---|---|
${seatRows}

- 席による大きな偏りがないかを見るための表です。親は毎回ランダムです

## 6. 読み方のメモ

- この結果は「CPUだけ・待ち時間なし」です。人間は、張る・ドボンの判断が遅かったり、ミスしたりするので、実際の割合とは変わります
- 試遊で気になった点(引き分けが多い、ゲームが長い・短いなど)は、この数字と比べて、パラメータやCPUの考えを調整します
`;

writeFileSync(OUTPUT, md);
console.log(md);

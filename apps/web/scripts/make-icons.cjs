// アイコン(PNG)を作る。使い方(Playwright が入っている環境で):node apps/web/scripts/make-icons.cjs
// ホームのロゴ(枠で囲んだ「DOBON」)を、黒地・白枠・オレンジのアクセントで描く。
const { chromium } = require('playwright');
const path = require('path');

const OUT = path.resolve(__dirname, '../public/icons');
const INK = '#222222';
const ACCENT = '#e8590c';

/** size:画像の一辺。scale:ロゴの大きさ(マスク用は小さくして、安全な範囲に収める)。rounded:角を丸めて外を透明にするか */
const html = (size, scale, rounded) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  .bg{width:${size}px;height:${size}px;background:${INK};${rounded ? `border-radius:${size * 0.2}px;` : ''}position:relative;overflow:hidden;
      display:flex;align-items:center;justify-content:center;flex-direction:column;gap:${size * 0.05 * scale}px}
  .logo{border:${size * 0.03 * scale}px solid #fff;padding:${size * 0.05 * scale}px ${size * 0.07 * scale}px;
        color:#fff;font:900 ${size * 0.17 * scale}px/1 -apple-system,'Inter','DejaVu Sans',sans-serif;letter-spacing:${size * 0.02 * scale}px}
  .bar{width:${size * 0.3 * scale}px;height:${size * 0.04 * scale}px;background:${ACCENT};border-radius:${size}px}
</style><div class="bg"><div class="logo">DOBON</div><div class="bar"></div></div>`;

const targets = [
  { file: 'icon-192.png', size: 192, scale: 0.82, rounded: true },
  { file: 'icon-512.png', size: 512, scale: 0.82, rounded: true },
  // マスク用(丸や角丸に切り抜かれても欠けないよう、ロゴは中央の約6割に収める。背景は端まで塗る)
  { file: 'icon-maskable-512.png', size: 512, scale: 0.7, rounded: false },
  // iPhone のホーム画面用(透明は使えない。角は iPhone が丸める)
  { file: 'apple-touch-icon.png', size: 180, scale: 0.9, rounded: false },
];

(async () => {
  const browser = await chromium.launch();
  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    await page.setContent(html(t.size, t.scale, t.rounded));
    await page.screenshot({ path: path.join(OUT, t.file), omitBackground: true, clip: { x: 0, y: 0, width: t.size, height: t.size } });
    await page.close();
    console.log('作った:', t.file);
  }
  await browser.close();
})();

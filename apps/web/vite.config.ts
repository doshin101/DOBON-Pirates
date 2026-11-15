import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * オフライン対応のサービスワーカー(sw/sw.template.js)を、ビルドのときに dist/sw.js として出力する。
 * - __PRECACHE__:最初に保存するファイルの一覧(ビルドで作られた JS・CSS、public のアイコンなど)
 * - __BUILD_ID__:ファイルの中身から作る印。中身が変われば印も変わり、古い保存は自動で消える
 */
function serviceWorkerPlugin(): Plugin {
  const publicDir = resolve(__dirname, 'public');
  return {
    name: 'dobon-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle);
      const publicFiles = listFiles(publicDir).filter((f) => f !== '_headers');
      const precache = ['./', ...[...assets, ...publicFiles].map((f) => `./${f}`)].sort();
      const hash = createHash('sha256');
      for (const name of assets) {
        const item = bundle[name];
        hash.update(name);
        if (item && item.type === 'chunk') hash.update(item.code);
      }
      for (const file of publicFiles) hash.update(readFileSync(join(publicDir, file)));
      const buildId = hash.digest('hex').slice(0, 12);
      const template = readFileSync(resolve(__dirname, 'sw/sw.template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: fill(template, buildId, precache),
      });
    },
  };
}

/** テンプレートの2つの目印を埋める。目印が見つからなければ、ビルドを止める(埋め忘れたまま公開しないため) */
function fill(template: string, buildId: string, precache: string[]): string {
  const marks = ['__BUILD_ID__', '__PRECACHE__'];
  for (const mark of marks) {
    if (template.split(mark).length !== 2) throw new Error(`sw.template.js の ${mark} が、ちょうど1つではない`);
  }
  return template.replace('__BUILD_ID__', buildId).replace('__PRECACHE__', JSON.stringify(precache, null, 2));
}

/** フォルダの中のファイルを、「icons/icon-192.png」のような相対の名前で並べる */
function listFiles(dir: string, base = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(join(dir, entry.name), `${base}${entry.name}/`)
      : [`${base}${entry.name}`],
  );
}

export default defineConfig({
  plugins: [react(), serviceWorkerPlugin()],
  build: { outDir: 'dist' },
});

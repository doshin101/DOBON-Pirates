import { describe, expect, it } from 'vitest';

// spec 11節:「画面の文字が、言語ファイル経由で出ている」を守るための検査。
// 画面のコード(apps/web/src。テスト以外)に、日本語や画面用の記号が直接書かれていたら落ちる。

// コードを文字として、まとめて読み込む(Vite の機能。新しい部品は不要)
const modules = import.meta.glob<string>(
  ['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx', '!./game/fakeScheduler.ts'],
  { query: '?raw', import: 'default', eager: true },
);
const files = Object.entries(modules);

/** コメントを取り除く(コメントには日本語を書いてよい) */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const TEXT_PATTERN = /[぀-ヿ一-鿿＀-￯≡▲▼↑↓←→×]/;

describe('画面の文字は、言語ファイル経由', () => {
  it('検査の対象が、ちゃんと見つかっている', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files)('%s に、直接書かれた日本語・記号がない', (_name, source) => {
    const code = stripComments(source);
    const hits = code.split('\n').filter((line) => TEXT_PATTERN.test(line));
    expect(hits, hits.join('\n')).toEqual([]);
  });
});

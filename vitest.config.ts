import { defineConfig } from 'vitest/config';

// ルートの `npm test` で、packages と apps のテストをまとめて動かす
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'apps/**/*.test.{ts,tsx}'],
  },
});

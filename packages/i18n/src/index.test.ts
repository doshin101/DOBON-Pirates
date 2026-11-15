import { describe, expect, it } from 'vitest';
import { en, format, getMessages, ja } from './index';

describe('format', () => {
  it('{名前} の穴を値で埋める', () => {
    expect(format('{name} がプレイ', { name: 'CPU 1' })).toBe('CPU 1 がプレイ');
    expect(format('山札 {count}', { count: 39 })).toBe('山札 39');
  });
  it('値がない穴は、そのまま残す', () => {
    expect(format('{a} と {b}', { a: 'x' })).toBe('x と {b}');
  });
});

describe('日本語ファイル', () => {
  it('ホーム画面の文字がある(M0)', () => {
    const m = getMessages();
    expect(m.app.title).toBe('DOBON');
    expect(m.home.playVsCpu).toBe('CPUと対戦');
  });
  it('13種類の数字と4種類のマークがそろっている', () => {
    const m = getMessages();
    expect(Object.keys(m.cards.ranks)).toHaveLength(13);
    expect(Object.keys(m.cards.suits)).toHaveLength(4);
  });
});

/** JSON の中の文字を、「キー(ドットでつなぐ) → 文字」の一覧にする */
function flatten(value: unknown, path = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof value === 'string') out.set(path, value);
  else if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${path}[${i}]`).forEach((s, k) => out.set(k, s)));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) flatten(v, path ? `${path}.${k}` : k).forEach((s, key) => out.set(key, s));
  }
  return out;
}
const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();

describe('英語ファイル(en.json)', () => {
  const jaFlat = flatten(ja);
  const enFlat = flatten(en);

  it('日本語と同じキーがすべてそろっている(足りないキーも、余分なキーもない)', () => {
    expect([...enFlat.keys()].sort()).toEqual([...jaFlat.keys()].sort());
  });
  it('すべて空でない文字が入っている', () => {
    for (const [key, text] of enFlat) expect(text.length, key).toBeGreaterThan(0);
  });
  it('{名前} の穴が、日本語と英語で同じ', () => {
    for (const [key, text] of jaFlat) expect(placeholders(enFlat.get(key) ?? ''), key).toEqual(placeholders(text));
  });
  it('英語の文字に、日本語の文字(ひらがな・カタカナ・漢字)が混ざっていない', () => {
    for (const [key, text] of enFlat) expect(/[぀-ヿ一-鿿]/.test(text), key).toBe(false);
  });
});

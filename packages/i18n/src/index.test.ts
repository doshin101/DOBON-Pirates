import { describe, expect, it } from 'vitest';
import { format, getMessages } from './index';

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

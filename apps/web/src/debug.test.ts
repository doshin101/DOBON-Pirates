import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSeed, parseSettings, parseSpeed, pickSeed } from './debug';

describe('デバッグ設定の読み取り', () => {
  it('何も付いていなければ、初期値(デバッグなし・ランダム・×1)', () => {
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS);
  });
  it('?debug=1 でデバッグ表示。?debug=0 や debug なしはオフ', () => {
    expect(parseSettings('?debug=1').debug).toBe(true);
    expect(parseSettings('?debug=0').debug).toBe(false);
    expect(parseSettings('?seed=5').debug).toBe(false);
  });
  it('?seed=123 でシードを指定。数字でないものは無視してランダムにする', () => {
    expect(parseSettings('?seed=123').seed).toBe(123);
    expect(parseSettings('?seed=0').seed).toBe(0);
    expect(parseSettings('?seed=abc').seed).toBeNull();
    expect(parseSettings('?seed=-5').seed).toBeNull();
    expect(parseSettings('?seed=1.5').seed).toBeNull();
    expect(parseSettings('?seed=99999999999').seed).toBeNull();
  });
  it('?speed=2 / 4 で速さを指定。それ以外は ×1', () => {
    expect(parseSettings('?speed=2').speed).toBe(2);
    expect(parseSettings('?speed=4').speed).toBe(4);
    expect(parseSettings('?speed=3').speed).toBe(1);
    expect(parseSpeed(null)).toBe(1);
  });
  it('組み合わせられる', () => {
    expect(parseSettings('?debug=1&seed=42&speed=4')).toEqual({ debug: true, seed: 42, speed: 4 });
  });
  it('parseSeed は空白を取り除く。空は null', () => {
    expect(parseSeed(' 77 ')).toBe(77);
    expect(parseSeed('')).toBeNull();
    expect(parseSeed(null)).toBeNull();
  });
  it('シードが決まっていれば毎回それ、なければ範囲内の整数', () => {
    expect(pickSeed({ ...DEFAULT_SETTINGS, seed: 9 })).toBe(9);
    expect(pickSeed({ ...DEFAULT_SETTINGS, seed: 9 })).toBe(9);
    const random = pickSeed(DEFAULT_SETTINGS);
    expect(Number.isInteger(random) && random >= 0).toBe(true);
  });
});

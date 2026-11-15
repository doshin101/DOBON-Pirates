import { describe, expect, it } from 'vitest';
import { FlickTracker } from './flick';

describe('上フリック(spec 6-2)', () => {
  it('タップだけ(動かさない)では発火しない', () => {
    const t = new FlickTracker();
    t.start(500);
    expect(t.move(500)).toBe(false);
    t.end();
  });
  it('上に47px動いただけでは発火しない。48px動いた時点で発火する(指を離すのを待たない)', () => {
    const t = new FlickTracker();
    t.start(500);
    expect(t.move(453)).toBe(false);
    expect(t.move(452)).toBe(true);
  });
  it('1回の操作で1回しか発火しない', () => {
    const t = new FlickTracker();
    t.start(500);
    expect(t.move(400)).toBe(true);
    expect(t.move(300)).toBe(false);
    expect(t.move(100)).toBe(false);
  });
  it('下や横に動いても発火しない', () => {
    const t = new FlickTracker();
    t.start(500);
    expect(t.move(600)).toBe(false);
    expect(t.move(500)).toBe(false);
  });
  it('押していないとき(start なし)は発火しない。離したあとも発火しない', () => {
    const t = new FlickTracker();
    expect(t.move(0)).toBe(false);
    t.start(500);
    t.end();
    expect(t.move(0)).toBe(false);
  });
  it('離してもう一度押せば、また発火できる', () => {
    const t = new FlickTracker();
    t.start(500);
    expect(t.move(400)).toBe(true);
    t.end();
    t.start(500);
    expect(t.move(400)).toBe(true);
  });
});

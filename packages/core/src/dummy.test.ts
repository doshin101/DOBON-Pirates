import { describe, expect, it } from 'vitest';
import { add } from './dummy';

describe('dummy', () => {
  it('add は2つの数を足す', () => {
    expect(add(2, 3)).toBe(5);
  });
});

import { describe, expect, it } from 'vitest';
import { getMessages } from '@dobon/i18n';
import type { Card, GameEvent, GameState } from '@dobon/core';
import { endLogText, logText, reasonText, toastText } from './text';

const m = getMessages();
const card: Card = { suit: 'S', rank: 8 };

describe('ログの文字', () => {
  it('他の人(CPU)のドボンの宣言は、判定までログに出さない。自分の宣言だけ出す', () => {
    const cpu: GameEvent = { type: 'dobonDeclared', player: 2 };
    const me: GameEvent = { type: 'dobonDeclared', player: 0 };
    expect(logText(m, cpu)).toBeNull();
    expect(logText(m, me)).toContain('ドボンを宣言');
  });
  it('他の人がドローしたカードは、ログに出さない。自分のドローは出す', () => {
    expect(logText(m, { type: 'drew', player: 1, card })).toBe('CPU 1(左) がドロー');
    expect(logText(m, { type: 'drew', player: 0, card })).toBe('あなた が ♠8 をドロー');
  });
  it('プレイ・張り・解除は、誰が何をしたかが分かる', () => {
    expect(logText(m, { type: 'played', player: 3, card })).toBe('CPU 3(右) が ♠8 をプレイ');
    expect(logText(m, { type: 'armed', player: 2, source: 'first' })).toBe('CPU 2(上) が張った');
    expect(logText(m, { type: 'disarmed', player: 1, handTotal: 15 })).toBe('CPU 1(左) の張りが外れた');
  });
  it('終わったあとに、結果の行が出る(宣言した人もここで分かる)', () => {
    const state = {
      topCard: card,
      hands: [[{ suit: 'H', rank: 3 }, { suit: 'D', rank: 5 }], [], [], []],
      result: { type: 'dobon', winner: 0, loser: 3 },
    } as unknown as GameState;
    expect(endLogText(m, state)).toContain('あなた の勝ち');
    expect(endLogText(m, state)).toContain('合計 8');
  });
});

describe('知らせ(トースト)の文字', () => {
  it('自分が張ったら「張りました」、他の人なら「○○が張った!」', () => {
    expect(toastText(m, { id: 1, kind: 'armed', player: 0 })).toBe('張りました');
    expect(toastText(m, { id: 1, kind: 'armed', player: 2 })).toBe('CPU 2(上) が張った!');
  });
  it('張れなかったときは合計を出す。解除と継続', () => {
    expect(toastText(m, { id: 1, kind: 'armFailed', player: 0, total: 17 })).toBe('張れませんでした(合計17)');
    expect(toastText(m, { id: 1, kind: 'disarmed', player: 3 })).toBe('CPU 3(右) の張りが外れた');
    expect(toastText(m, { id: 1, kind: 'stillArmed', player: 1 })).toBe('CPU 1(左) 継続');
  });
});

describe('押せない理由の文字', () => {
  it('張るボタンの「自分の番ではありません」は「自分のターンのみ」になる', () => {
    expect(reasonText(m, 'notYourTurn', 'play')).toBe('自分の番ではありません');
    expect(reasonText(m, 'notYourTurn', 'arm')).toBe('自分のターンのみ');
    expect(reasonText(m, 'totalTooHigh', 'arm')).toBe('合計が14以上');
    expect(reasonText(m, 'resolutionPending', 'draw')).toBe('判定中');
    expect(reasonText(m, null, 'draw')).toBe('');
  });
});

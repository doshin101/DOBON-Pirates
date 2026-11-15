import type { Card, GameState, Phase, PlayerId, Quad } from './types';

/**
 * 1人のプレイヤーに見せてよい情報(M-8)。CPU の考え(decide)は、これだけを受け取る。
 * 他の人の手札の中身、山札の順番、他の人の仮押し・ドボンの宣言は含まない。
 */
export interface PlayerView {
  readonly player: PlayerId;
  /** 自分の手札 */
  readonly hand: readonly Card[];
  /** 全員の手札の枚数 */
  readonly handCounts: Quad<number>;
  /** 誰が張っているか(全員に公開) */
  readonly armed: Quad<boolean>;
  /** 自分が仮押し中か */
  readonly provisionalArm: boolean;
  /** 自分が今の受付でドボンを宣言したか */
  readonly declared: boolean;
  readonly topCard: Card;
  /** 場札をプレイした人。最初の場札なら null */
  readonly topCardPlayedBy: PlayerId | null;
  readonly startingPlayer: PlayerId;
  readonly currentPlayer: PlayerId;
  readonly phase: Phase;
  readonly dobonWindowOpen: boolean;
  readonly stockCount: number;
}

export function getPlayerView(state: GameState, player: PlayerId): PlayerView {
  return {
    player,
    hand: state.hands[player],
    handCounts: [
      state.hands[0].length,
      state.hands[1].length,
      state.hands[2].length,
      state.hands[3].length,
    ],
    armed: state.armed,
    provisionalArm: state.provisionalArm[player],
    declared: state.declarations.includes(player),
    topCard: state.topCard,
    topCardPlayedBy: state.topCardPlayedBy,
    startingPlayer: state.startingPlayer,
    currentPlayer: state.currentPlayer,
    phase: state.phase,
    dobonWindowOpen: state.dobonWindowOpen,
    stockCount: state.stock.length,
  };
}

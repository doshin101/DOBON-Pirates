import {
  ARM_MAX_TOTAL,
  handTotal,
  playableCards,
  type Action,
  type Card,
  type PlayerId,
  type PlayerView,
  type Rng,
} from '@dobon/core';

/** CPUが「いまやりたいこと」。いつ実行するか(待ち時間)は、呼ぶ側が決める */
export type CpuDecision =
  | { readonly kind: 'none' }
  | { readonly kind: 'arm' }
  | { readonly kind: 'dobon' }
  | { readonly kind: 'play'; readonly card: Card }
  | { readonly kind: 'draw' }
  | { readonly kind: 'pass' };

const NONE: CpuDecision = { kind: 'none' };

/**
 * CPUの考え(spec 7節)。公開情報と自分の手札(PlayerView)だけで決める。
 * 難易度はない。あとで難易度を足すときは、この関数の中だけを変える。
 *
 * 優先順位:ドボン > 張り > ターンの操作
 * - ドボン:張っていて、他の人がプレイした場札の数字が自分の合計と一致したら、必ず宣言する
 * - 張り:開始時(初張り)と、自分のターンの操作完了の直後(④)に、合計13以下なら必ず張る
 * - 操作:出せるカードがあればランダムに1枚プレイ。なければドロー。
 *   ドローのあと、出せればランダムにプレイ、なければパス。手札1枚ならまずドロー
 */
export function decide(view: PlayerView, rng: Rng): CpuDecision {
  if (view.phase === 'finished') return NONE;

  const total = handTotal(view.hand);
  const armed = view.armed[view.player];

  // ドボン(チョンボはしない:合計が一致しているときだけ)
  if (
    view.dobonWindowOpen &&
    armed &&
    !view.declared &&
    view.topCardPlayedBy !== null &&
    view.topCardPlayedBy !== view.player &&
    total === view.topCard.rank
  ) {
    return { kind: 'dobon' };
  }

  // 張り:開始時の受付、または自分のターンの④
  const canArmNow =
    view.phase === 'startWindow' || (view.phase === 'accept' && view.currentPlayer === view.player);
  if (canArmNow) {
    return !armed && total <= ARM_MAX_TOTAL ? { kind: 'arm' } : NONE;
  }

  // ターンの操作
  if (view.currentPlayer !== view.player) return NONE;
  const playable = playableCards(view.hand, view.topCard);
  if (view.phase === 'awaitAction') {
    if (view.hand.length >= 2 && playable.length > 0) return playRandom(playable, rng);
    return { kind: 'draw' };
  }
  if (view.phase === 'afterDraw') {
    return playable.length > 0 ? playRandom(playable, rng) : { kind: 'pass' };
  }
  return NONE;
}

function playRandom(playable: readonly Card[], rng: Rng): CpuDecision {
  return { kind: 'play', card: playable[rng.nextInt(playable.length)] as Card };
}

/** 決めたことを、core に渡す操作に直す。何もしないときは null */
export function toAction(decision: CpuDecision, player: PlayerId): Action | null {
  switch (decision.kind) {
    case 'arm':
      return { type: 'arm', player };
    case 'dobon':
      return { type: 'dobon', player };
    case 'play':
      return { type: 'play', player, card: decision.card };
    case 'draw':
      return { type: 'draw', player };
    case 'pass':
      return { type: 'pass', player };
    case 'none':
      return null;
  }
}

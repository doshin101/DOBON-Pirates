// ルールの型。名前は docs/rules/glossary.md の「コードでの名前」に合わせる。

/** マーク:S=スペード H=ハート D=ダイヤ C=クラブ */
export type Suit = 'S' | 'H' | 'D' | 'C';

/** 数字:A=1、2〜10、J=11、Q=12、K=13 */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  readonly suit: Suit;
  readonly rank: Rank;
}

/** 席の番号。0=自分、1=左、2=上、3=右。時計回りは (番号 + 1) % 4 */
export type PlayerId = 0 | 1 | 2 | 3;

/** 4人ぶんの値(席の番号で取り出せる) */
export type Quad<T> = readonly [T, T, T, T];

export const PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];
export const PLAYER_COUNT = 4;

/** ルールで決まっている数(時間のパラメータではない) */
export const START_HAND_SIZE = 3;
export const ARM_MAX_TOTAL = 13;

/**
 * ゲームの段階。
 * - startWindow:開始時の受付(初張りができる)
 * - awaitAction:②操作待機(①ターン開始もここに含める)
 * - afterDraw:③操作中(ドローのあと)
 * - accept:④受付中(操作完了の直後。⑤ターン終了の前)
 * - finished:ゲーム終了
 */
export type Phase = 'startWindow' | 'awaitAction' | 'afterDraw' | 'accept' | 'finished';

export type GameResult =
  | { readonly type: 'dobon'; readonly winner: PlayerId; readonly loser: PlayerId }
  | { readonly type: 'foul'; readonly losers: readonly PlayerId[] }
  | { readonly type: 'noContest' };

export interface GameState {
  /** 山札。次にドローされるカードが先頭(index 0) */
  readonly stock: readonly Card[];
  readonly hands: Quad<readonly Card[]>;
  /** 捨て札(最初の場札とプレイされたカード全部。最後が場札) */
  readonly discard: readonly Card[];
  readonly topCard: Card;
  /** 場札をプレイした人。最初の場札のときは null(= isStartingTopCard) */
  readonly topCardPlayedBy: PlayerId | null;
  readonly startingPlayer: PlayerId;
  readonly currentPlayer: PlayerId;
  readonly phase: Phase;
  /** 張りが確定している人(全員に公開される) */
  readonly armed: Quad<boolean>;
  /** 仮押し中の人(操作完了の時点で確定か失敗が決まる) */
  readonly provisionalArm: Quad<boolean>;
  /** 手番のプレイヤーが、ターン開始時に張っていたか(継続の判定用) */
  readonly armedAtTurnStart: boolean;
  /** ドボン受付中か */
  readonly dobonWindowOpen: boolean;
  /** 今の受付でドボンを宣言した人(宣言順)。判定までは本人以外に見せない */
  readonly declarations: readonly PlayerId[];
  /** 始まったターンの数(最初のターンが1) */
  readonly turnCount: number;
  readonly result: GameResult | null;
}

/** 操作(状態を変えるもの)。時間に関わるものも、外から渡す操作にしている */
export type Action =
  | { readonly type: 'arm'; readonly player: PlayerId }
  | { readonly type: 'play'; readonly player: PlayerId; readonly card: Card }
  | { readonly type: 'draw'; readonly player: PlayerId }
  | { readonly type: 'pass'; readonly player: PlayerId }
  | { readonly type: 'dobon'; readonly player: PlayerId }
  /** 開始時の受付が終わった。親のターンが始まる */
  | { readonly type: 'endStartWindow' }
  /** ④(操作完了の直後)が終わった。ターンが終わり、次の人のターンが始まる */
  | { readonly type: 'endTurn' }
  /** 猶予が終わった。ドボンとチョンボを判定する */
  | { readonly type: 'resolve' };

export type ArmSource = 'first' | 'immediate' | 'provisional';

/** 起きたこと。ログや将来の演出に使う。dobonDeclared は判定まで本人以外に見せないこと */
export type GameEvent =
  | { readonly type: 'gameStarted'; readonly startingPlayer: PlayerId; readonly topCard: Card }
  | { readonly type: 'startWindowEnded' }
  | { readonly type: 'turnStarted'; readonly player: PlayerId }
  | { readonly type: 'played'; readonly player: PlayerId; readonly card: Card }
  | { readonly type: 'drew'; readonly player: PlayerId; readonly card: Card }
  | { readonly type: 'passed'; readonly player: PlayerId }
  | { readonly type: 'armPressed'; readonly player: PlayerId }
  | { readonly type: 'armed'; readonly player: PlayerId; readonly source: ArmSource }
  | { readonly type: 'armFailed'; readonly player: PlayerId; readonly handTotal: number }
  | { readonly type: 'disarmed'; readonly player: PlayerId; readonly handTotal: number }
  | { readonly type: 'stillArmed'; readonly player: PlayerId }
  | { readonly type: 'dobonWindowOpened'; readonly card: Card; readonly playedBy: PlayerId }
  | { readonly type: 'dobonWindowClosed' }
  | { readonly type: 'dobonDeclared'; readonly player: PlayerId }
  | { readonly type: 'dobonVoid'; readonly player: PlayerId }
  | { readonly type: 'gameEnded'; readonly result: GameResult };

/** 操作が受け付けられない理由(画面の文字は i18n 側で、この名前から選ぶ) */
export type ActionErrorCode =
  | 'gameFinished'
  | 'wrongPhase'
  | 'notYourTurn'
  | 'cardNotInHand'
  | 'cardNotPlayable'
  | 'mustDrawFirst' // 手札が1枚のときは先にドロー
  | 'noPlayableCard' // 出せるカードがありません
  | 'hasPlayableCard' // 出せるカードがあります
  | 'alreadyDrew' // ドローは1回だけ
  | 'drawFirst' // パスはドローの後だけ
  | 'totalTooHigh' // 合計が14以上
  | 'alreadyArmed'
  | 'notArmed'
  | 'startingTopCard' // 最初の場札にはドボンできない
  | 'ownCard' // 自分がプレイしたカードにはドボンできない
  | 'alreadyDeclared'
  | 'resolutionPending' // 判定中
  | 'nothingToResolve';

export type Check = { readonly ok: true } | { readonly ok: false; readonly reason: ActionErrorCode };

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly state: GameState; readonly error: ActionErrorCode };

export function nextPlayer(player: PlayerId): PlayerId {
  return ((player + 1) % PLAYER_COUNT) as PlayerId;
}

/** 4人ぶんの値の1か所だけを入れ替えた、新しい組を返す */
export function setQuad<T>(quad: Quad<T>, player: PlayerId, value: T): Quad<T> {
  return quad.map((v, i) => (i === player ? value : v)) as unknown as Quad<T>;
}

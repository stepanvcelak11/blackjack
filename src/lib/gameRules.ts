// Čistá (bezstavová) pravidla hry DiceJack 12.

export const TARGET = 12;
export const DEALER_STANDS_ON = 9; // krupiér přihazuje na 8 a méně
export const STARTING_BANKROLL = 1000;
export const MIN_BET = 10;
export const CHIP_VALUES = [10, 25, 50, 100] as const;
export const DICEJACK_PAYOUT = 2; // 2:1

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface Die {
  id: string;
  value: DieValue;
  /** Animace dopadu doběhla – teprve pak se hodnota počítá do zobrazeného součtu. */
  settled: boolean;
  /** Skrytá kostka krupiéra pod kelímkem. */
  hidden?: boolean;
}

export type HandStatus = 'playing' | 'stood' | 'bust' | 'dicejack';
export type Outcome = 'dicejack' | 'win' | 'push' | 'lose' | 'bust';

export interface Hand {
  id: string;
  dice: Die[];
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  status: HandStatus;
  outcome?: Outcome;
  /** Celková částka vrácená hráči (vklad + výhra). */
  payout?: number;
}

export type Phase = 'betting' | 'dealing' | 'player' | 'dealer' | 'settled';

let idCounter = 0;
export const uid = (prefix = 'd'): string => `${prefix}${++idCounter}-${Date.now().toString(36)}`;

/** Férový hod 1d6 přes crypto RNG (bez modulo biasu). */
export function rollD6(): DieValue {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint8Array(1);
    // 252 = největší násobek 6 pod 256
    do c.getRandomValues(buf);
    while (buf[0] >= 252);
    return ((buf[0] % 6) + 1) as DieValue;
  }
  return (Math.floor(Math.random() * 6) + 1) as DieValue;
}

export const newDie = (value: DieValue = rollD6(), hidden = false): Die => ({
  id: uid('die'),
  value,
  settled: false,
  hidden,
});

export const total = (dice: Die[]): number => dice.reduce((s, d) => s + d.value, 0);

/** Součet, který vidí hráč – jen dopadlé a odkryté kostky. */
export const visibleTotal = (dice: Die[]): number =>
  dice.reduce((s, d) => s + (d.settled && !d.hidden ? d.value : 0), 0);

export const isBust = (dice: Die[]): boolean => total(dice) > TARGET;

/** DiceJack = 6 + 6 ze dvou úvodních kostek (ne po splitu). */
export const isNatural = (dice: Die[], fromSplit = false): boolean =>
  !fromSplit && dice.length === 2 && total(dice) === TARGET;

export const dealerShouldHit = (dice: Die[]): boolean => total(dice) < DEALER_STANDS_ON;

export const canDouble = (hand: Hand, bankroll: number): boolean =>
  hand.status === 'playing' && hand.dice.length === 2 && !hand.doubled && bankroll >= hand.bet;

export const canSplit = (hands: Hand[], hand: Hand, bankroll: number): boolean =>
  hands.length === 1 &&
  hand.status === 'playing' &&
  hand.dice.length === 2 &&
  hand.dice[0].value === hand.dice[1].value &&
  bankroll >= hand.bet;

/** Vyhodnotí jednu ruku proti krupiérovi. */
export function settleHand(hand: Hand, dealerDice: Die[], dealerNatural: boolean): Hand {
  const player = total(hand.dice);
  const dealer = total(dealerDice);
  let outcome: Outcome;
  let payout: number;

  if (player > TARGET) {
    outcome = 'bust';
    payout = 0;
  } else if (hand.status === 'dicejack') {
    outcome = dealerNatural ? 'push' : 'dicejack';
    payout = dealerNatural ? hand.bet : hand.bet + hand.bet * DICEJACK_PAYOUT;
  } else if (dealerNatural) {
    outcome = 'lose';
    payout = 0;
  } else if (dealer > TARGET || player > dealer) {
    outcome = 'win';
    payout = hand.bet * 2;
  } else if (player === dealer) {
    outcome = 'push';
    payout = hand.bet;
  } else {
    outcome = 'lose';
    payout = 0;
  }
  return { ...hand, outcome, payout };
}

/** Barevný indikátor rizika podle součtu. */
export function riskLevel(sum: number): 'safe' | 'warn' | 'danger' | 'perfect' | 'bust' {
  if (sum > TARGET) return 'bust';
  if (sum === TARGET) return 'perfect';
  if (sum >= 10) return 'danger'; // 10–11: přihození riskuje 4–5 ze 6 hodů
  if (sum >= 7) return 'warn'; // 7–9: tropa hrozí
  return 'safe'; // 6 a méně: další kostka nikdy nepřetáhne
}

/** Pravděpodobnost tropy při dalším hodu (v %). */
export function bustChance(sum: number): number {
  const safe = Math.max(0, Math.min(6, TARGET - sum));
  return Math.round(((6 - safe) / 6) * 100);
}

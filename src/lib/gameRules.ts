// Čistá (bezstavová) pravidla hry DiceJack 12.

export const TARGET = 12;
export const DEALER_STANDS_ON = 9; // krupiér přihazuje na 8 a méně a na měkkou 9
export const STARTING_BANKROLL = 1000;
export const MIN_BET = 10;
export const CHIP_VALUES = [10, 25, 50, 100] as const;
export const DICEJACK_PAYOUT = 2; // 2:1
export const CHARLIE_PAYOUT = 2; // 2:1
export const CHARLIE_DICE = 4;
export const PAIR_PAYOUT = 4; // 4:1
export const ACE_BONUS = 3; // jednička se počítá jako 1 nebo 4
export const HOT_STREAK_AT = 3;
export const HOT_STREAK_BONUS = 0.2; // +20 % z čisté výhry
export const SAFE_HIT_TOTALS = [8, 9, 10] as const;
export const SAFE_HIT_COST = 0.5; // 50 % aktuální sázky

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export type DieKind = 'd6' | 'd3';

export interface Die {
  id: string;
  value: DieValue;
  kind: DieKind;
  /** Animace dopadu doběhla – teprve pak se hodnota počítá do zobrazeného součtu. */
  settled: boolean;
  /** Skrytá kostka krupiéra pod kelímkem. */
  hidden?: boolean;
}

export type HandStatus = 'playing' | 'stood' | 'bust' | 'dicejack' | 'charlie';
export type Outcome = 'dicejack' | 'charlie' | 'win' | 'push' | 'lose' | 'bust';

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

/** Férový hod kostkou se `sides` stěnami přes crypto RNG (bez modulo biasu). */
export function rollDie(sides: 3 | 6 = 6): DieValue {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint8Array(1);
    // 252 = největší násobek 6 (i 3) pod 256
    do c.getRandomValues(buf);
    while (buf[0] >= 252);
    return ((buf[0] % sides) + 1) as DieValue;
  }
  return (Math.floor(Math.random() * sides) + 1) as DieValue;
}

export const newDie = (kind: DieKind = 'd6', hidden = false): Die => ({
  id: uid('die'),
  value: rollDie(kind === 'd3' ? 3 : 6),
  kind,
  settled: false,
  hidden,
});

export interface Score {
  /** Všechny jedničky jako 1. */
  hard: number;
  /** Nejlepší součet: co nejvíc jedniček jako 4, aniž by se přetáhlo 12. */
  best: number;
  /** Aspoň jedna jednička se počítá jako 4 (hodnota se ještě může „zlomit“). */
  soft: boolean;
}

export function score(dice: Pick<Die, 'value'>[]): Score {
  let hard = 0;
  let ones = 0;
  for (const d of dice) {
    hard += d.value;
    if (d.value === 1) ones++;
  }
  let best = hard;
  let used = 0;
  while (used < ones && best + ACE_BONUS <= TARGET) {
    best += ACE_BONUS;
    used++;
  }
  return { hard, best, soft: used > 0 };
}

/** Skóre, které vidí hráč – jen dopadlé a odkryté kostky. */
export const visibleScore = (dice: Die[]): Score => score(dice.filter((d) => d.settled && !d.hidden));

export const isBust = (dice: Die[]): boolean => score(dice).hard > TARGET;

/** DiceJack = 12 ze dvou úvodních kostek (6 + 6), ne po splitu. */
export const isNatural = (dice: Die[], fromSplit = false): boolean =>
  !fromSplit && dice.length === 2 && score(dice).best === TARGET;

/** Krupiér přihazuje na 8 a méně a na měkkou 9, stojí na tvrdé 9 a výš. */
export function dealerShouldHit(dice: Die[]): boolean {
  const s = score(dice);
  return s.best < DEALER_STANDS_ON || (s.best === DEALER_STANDS_ON && s.soft);
}

export const canDouble = (hand: Hand, bankroll: number): boolean =>
  hand.status === 'playing' && hand.dice.length === 2 && !hand.doubled && bankroll >= hand.bet;

export const canSplit = (hands: Hand[], hand: Hand, bankroll: number): boolean =>
  hands.length === 1 &&
  hand.status === 'playing' &&
  hand.dice.length === 2 &&
  hand.dice[0].value === hand.dice[1].value &&
  bankroll >= hand.bet;

export const safeHitCost = (hand: Hand): number => Math.ceil(hand.bet * SAFE_HIT_COST);

export const canSafeHit = (hand: Hand, bankroll: number, used: boolean): boolean =>
  !used &&
  hand.status === 'playing' &&
  (SAFE_HIT_TOTALS as readonly number[]).includes(score(hand.dice).best) &&
  bankroll >= safeHitCost(hand);

export const isPair = (dice: Die[]): boolean => dice.length >= 2 && dice[0].value === dice[1].value;

/** Vyhodnotí jednu ruku proti krupiérovi. */
export function settleHand(hand: Hand, dealerDice: Die[], dealerNatural: boolean): Hand {
  const player = score(hand.dice);
  const dealer = score(dealerDice);
  let outcome: Outcome;
  let payout: number;

  if (player.hard > TARGET) {
    outcome = 'bust';
    payout = 0;
  } else if (hand.status === 'charlie') {
    outcome = 'charlie';
    payout = hand.bet + hand.bet * CHARLIE_PAYOUT;
  } else if (hand.status === 'dicejack') {
    outcome = dealerNatural ? 'push' : 'dicejack';
    payout = dealerNatural ? hand.bet : hand.bet + hand.bet * DICEJACK_PAYOUT;
  } else if (dealerNatural) {
    outcome = 'lose';
    payout = 0;
  } else if (dealer.hard > TARGET || player.best > dealer.best) {
    outcome = 'win';
    payout = hand.bet * 2;
  } else if (player.best === dealer.best) {
    outcome = 'push';
    payout = hand.bet;
  } else {
    outcome = 'lose';
    payout = 0;
  }
  return { ...hand, outcome, payout };
}

/** Barevný indikátor rizika podle nejlepšího součtu. */
export function riskLevel(s: Score): 'safe' | 'warn' | 'danger' | 'perfect' | 'bust' {
  if (s.hard > TARGET) return 'bust';
  if (s.best === TARGET) return 'perfect';
  // u měkké ruky riziko určuje tvrdý součet (jednička se může zlomit na 1)
  const risky = s.hard;
  if (risky >= 10) return 'danger';
  if (risky >= 7) return 'warn';
  return 'safe';
}

/** Pravděpodobnost tropy při dalším hodu kostkou (v %). */
export function bustChance(s: Score, sides: 3 | 6 = 6): number {
  const safe = Math.max(0, Math.min(sides, TARGET - s.hard));
  return Math.round(((sides - safe) / sides) * 100);
}

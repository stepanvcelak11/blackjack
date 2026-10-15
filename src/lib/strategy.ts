// Přesná základní strategie DiceJack 12 – očekávaná hodnota (EV) každého tahu
// spočítaná dynamickým programováním nad nekonečným „bankem“ kostek.
//
// Model odpovídá pravidlům hry: jednička = 1/4 (měkká), auto-stop na 12,
// 4-Kostkový Charlie 2:1, krupiér táhne do 8 a na měkkou 9, s viditelnou
// šestkou nahlíží (hráč tedy rozhoduje jen když krupiér nemá 6+6),
// bezpečný příhoz d3 za 50 % sázky jednou za kolo.

import { ACE_BONUS, CHARLIE_DICE, CHARLIE_PAYOUT, SAFE_HIT_COST, SAFE_HIT_TOTALS, TARGET } from './gameRules';

export type Move = 'H' | 'S' | 'D' | 'P' | 'B';

export const MOVE_LABEL: Record<Move, string> = {
  H: 'Přihodit',
  S: 'Stát',
  D: 'Double',
  P: 'Rozdělit',
  B: 'Bezpečný příhoz (d3)',
};

const FACES6 = [1, 2, 3, 4, 5, 6];
const FACES3 = [1, 2, 3];

function best(hard: number, ones: number): number {
  let b = hard;
  for (let i = 0; i < ones && b + ACE_BONUS <= TARGET; i++) b += ACE_BONUS;
  return b;
}
const isSoft = (hard: number, ones: number) => best(hard, ones) !== hard;

// ---------- Krupiér ----------

/** Pravděpodobnosti konečného stavu krupiéra: index 9–12 = součet, 13 = tropa. */
type DealerDist = Record<9 | 10 | 11 | 12 | 13, number>;

const dealerMemo = new Map<string, DealerDist>();

function dealerFinal(hard: number, ones: number): DealerDist {
  const key = `${hard},${ones}`;
  const hit = dealerMemo.get(key);
  if (hit) return hit;
  const out: DealerDist = { 9: 0, 10: 0, 11: 0, 12: 0, 13: 0 };
  if (hard > TARGET) {
    out[13] = 1;
  } else {
    const b = best(hard, ones);
    const mustHit = b < 9 || (b === 9 && isSoft(hard, ones));
    if (!mustHit) {
      out[b as 9 | 10 | 11 | 12] = 1;
    } else {
      for (const v of FACES6) {
        const sub = dealerFinal(hard + v, ones + (v === 1 ? 1 : 0));
        for (const k of [9, 10, 11, 12, 13] as const) out[k] += sub[k] / 6;
      }
    }
  }
  dealerMemo.set(key, out);
  return out;
}

const upMemo = new Map<number, DealerDist>();

/** Rozložení krupiéra podle viditelné kostky (při šestce je 6+6 vyloučeno nahlédnutím). */
export function dealerDistribution(up: number): DealerDist {
  const cached = upMemo.get(up);
  if (cached) return cached;
  const holes = up === 6 ? [1, 2, 3, 4, 5] : FACES6;
  const out: DealerDist = { 9: 0, 10: 0, 11: 0, 12: 0, 13: 0 };
  for (const h of holes) {
    const sub = dealerFinal(up + h, (up === 1 ? 1 : 0) + (h === 1 ? 1 : 0));
    for (const k of [9, 10, 11, 12, 13] as const) out[k] += sub[k] / holes.length;
  }
  upMemo.set(up, out);
  return out;
}

// ---------- Hráč ----------

function standEV(p: number, d: DealerDist): number {
  let ev = d[13];
  for (const k of [9, 10, 11, 12] as const) ev += d[k] * Math.sign(p - k);
  return ev;
}

class Solver {
  private memo = new Map<string, number>();
  constructor(private d: DealerDist) {}

  /** EV ruky při optimální hře (bez double/split – ty jsou jen na začátku). */
  value(hard: number, ones: number, n: number, d3: boolean): number {
    if (hard > TARGET) return -1;
    if (n >= CHARLIE_DICE) return CHARLIE_PAYOUT;
    const b = best(hard, ones);
    if (b === TARGET) return standEV(b, this.d);
    const key = `${hard},${ones},${n},${d3 ? 1 : 0}`;
    const m = this.memo.get(key);
    if (m !== undefined) return m;
    let v = Math.max(this.standEv(hard, ones), this.hitEv(hard, ones, n, d3));
    if (d3 && this.safeAllowed(hard, ones)) v = Math.max(v, this.safeEv(hard, ones, n));
    this.memo.set(key, v);
    return v;
  }

  standEv(hard: number, ones: number) {
    return hard > TARGET ? -1 : standEV(best(hard, ones), this.d);
  }

  hitEv(hard: number, ones: number, n: number, d3: boolean) {
    let s = 0;
    for (const v of FACES6) s += this.value(hard + v, ones + (v === 1 ? 1 : 0), n + 1, d3);
    return s / 6;
  }

  safeAllowed(hard: number, ones: number) {
    return (SAFE_HIT_TOTALS as readonly number[]).includes(best(hard, ones));
  }

  safeEv(hard: number, ones: number, n: number) {
    let s = 0;
    for (const v of FACES3) s += this.value(hard + v, ones + (v === 1 ? 1 : 0), n + 1, false);
    return s / 3 - SAFE_HIT_COST;
  }

  doubleEv(hard: number, ones: number, n: number) {
    let s = 0;
    for (const v of FACES6) {
      const h = hard + v;
      const o = ones + (v === 1 ? 1 : 0);
      // Po double tah končí; Charlie se na 3 kostkách nemůže stát.
      s += h > TARGET ? -1 : n + 1 >= CHARLIE_DICE ? CHARLIE_PAYOUT : standEV(best(h, o), this.d);
    }
    return (2 * s) / 6;
  }

  /** Nejlepší hodnota ruky po splitu (2 kostky, double povolen). */
  splitHand(v: number, w: number, d3: boolean) {
    const hard = v + w;
    const ones = (v === 1 ? 1 : 0) + (w === 1 ? 1 : 0);
    return Math.max(this.value(hard, ones, 2, d3), this.doubleEv(hard, ones, 2));
  }

  splitEv(v: number, d3: boolean) {
    let a = 0;
    let b = 0;
    for (const w of FACES6) {
      a += this.splitHand(v, w, d3);
      // Cinknutou kostku lze v kole použít jen jednou – druhé ruce ji nepočítáme.
      b += this.splitHand(v, w, false);
    }
    return (a + b) / 6;
  }
}

const solvers = new Map<number, Solver>();
function solver(up: number): Solver {
  let s = solvers.get(up);
  if (!s) {
    s = new Solver(dealerDistribution(up));
    solvers.set(up, s);
  }
  return s;
}

export interface Situation {
  /** Hodnoty kostek aktivní ruky. */
  dice: number[];
  /** Viditelná kostka krupiéra. */
  up: number;
  canDouble: boolean;
  canSplit: boolean;
  /** Bezpečný příhoz je k dispozici (součet 8–10, nepoužit, dost žetonů). */
  canSafe: boolean;
}

export interface Advice {
  best: Move;
  /** EV v násobcích původní sázky ruky. */
  evs: Partial<Record<Move, number>>;
}

export function advise(sit: Situation): Advice {
  const s = solver(sit.up);
  const hard = sit.dice.reduce((a, b) => a + b, 0);
  const ones = sit.dice.filter((v) => v === 1).length;
  const n = sit.dice.length;
  const evs: Partial<Record<Move, number>> = {
    S: s.standEv(hard, ones),
    H: s.hitEv(hard, ones, n, sit.canSafe),
  };
  if (sit.canDouble && n === 2) evs.D = s.doubleEv(hard, ones, n);
  if (sit.canSplit && n === 2 && sit.dice[0] === sit.dice[1]) evs.P = s.splitEv(sit.dice[0], true);
  if (sit.canSafe && s.safeAllowed(hard, ones)) evs.B = s.safeEv(hard, ones, n);
  let bestMove: Move = 'S';
  for (const [m, v] of Object.entries(evs) as [Move, number][]) {
    if (v > (evs[bestMove] ?? -Infinity) + 1e-9) bestMove = m;
  }
  return { best: bestMove, evs };
}

// ---------- Strategické tabulky ----------

/** Kód buňky: hlavní tah + náhradní tah, když hlavní nejde (Ds = double, jinak stát). */
export type ChartCell = 'H' | 'S' | 'D' | 'Ds' | 'P' | 'Ph' | 'Ps' | 'B' | 'Bs';

function cellFor(dice: number[], up: number, allowSplit: boolean): ChartCell {
  const full = advise({ dice, up, canDouble: dice.length === 2, canSplit: allowSplit, canSafe: true });
  const plain = advise({ dice, up, canDouble: false, canSplit: false, canSafe: false }).best as 'H' | 'S';
  switch (full.best) {
    case 'D':
      return plain === 'S' ? 'Ds' : 'D';
    case 'P': {
      const noSplit = advise({ dice, up, canDouble: dice.length === 2, canSplit: false, canSafe: true }).best;
      return noSplit === 'S' ? 'Ps' : noSplit === 'H' ? 'Ph' : 'P';
    }
    case 'B':
      return plain === 'S' ? 'Bs' : 'B';
    default:
      return full.best as 'H' | 'S';
  }
}

export interface ChartRow {
  label: string;
  sub?: string;
  cells: ChartCell[];
}

export const UPCARDS = [1, 2, 3, 4, 5, 6];

export type ChartKind = 'hard' | 'soft' | 'pairs' | 'three';

const chartMemo = new Map<ChartKind, ChartRow[]>();

export function chart(kind: ChartKind): ChartRow[] {
  const cached = chartMemo.get(kind);
  if (cached) return cached;
  let rows: ChartRow[] = [];
  if (kind === 'hard') {
    // 2 kostky bez jedničky; reprezentant součtu, který není pár.
    const rep: Record<number, number[]> = {
      4: [2, 2], 5: [2, 3], 6: [2, 4], 7: [2, 5], 8: [3, 5], 9: [3, 6], 10: [4, 6], 11: [5, 6],
    };
    rows = Object.entries(rep).map(([t, dice]) => ({
      label: t,
      sub: t === '4' ? '2+2' : undefined,
      cells: UPCARDS.map((u) => cellFor(dice, u, false)),
    }));
  } else if (kind === 'soft') {
    rows = [2, 3, 4, 5, 6].map((x) => ({
      label: `1+${x}`,
      sub: `${1 + x} / ${4 + x}`,
      cells: UPCARDS.map((u) => cellFor([1, x], u, false)),
    }));
  } else if (kind === 'pairs') {
    rows = [1, 2, 3, 4, 5].map((v) => ({
      label: `${v}-${v}`,
      cells: UPCARDS.map((u) => cellFor([v, v], u, true)),
    }));
  } else {
    // 3 kostky bez jedničky (blízko Charlieho).
    const rep: Record<number, number[]> = {
      6: [2, 2, 2], 7: [2, 2, 3], 8: [2, 3, 3], 9: [3, 3, 3], 10: [3, 3, 4], 11: [3, 4, 4],
    };
    rows = Object.entries(rep).map(([t, dice]) => ({
      label: t,
      cells: UPCARDS.map((u) => cellFor(dice, u, false)),
    }));
  }
  chartMemo.set(kind, rows);
  return rows;
}

/** Pravděpodobnost tropy dalším hodem d6 podle tvrdého součtu (v %). */
export const bustPercent = (hard: number) => Math.round((Math.max(0, 6 - Math.max(0, TARGET - hard)) / 6) * 100);

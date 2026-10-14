import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MIN_BET,
  STARTING_BANKROLL,
  canDouble,
  canSplit,
  dealerShouldHit,
  isNatural,
  newDie,
  settleHand,
  total,
  uid,
  type Die,
  type Hand,
  type Phase,
} from '../lib/gameRules';
import {
  playBust,
  playChip,
  playDiceJack,
  playDiceRoll,
  playLose,
  playPush,
  playReveal,
  playWin,
} from '../lib/soundEffects';

/** Délka animace hodu – musí odpovídat komponentě Die. */
export const ROLL_MS = 650;
const STORAGE_KEY = 'dicejack12:v1';

export interface GameState {
  phase: Phase;
  /** Volné peníze hráče (sázka se z nich odečítá už při pokládání žetonů). */
  bankroll: number;
  /** Rozpracovaná sázka ve fázi sázení. */
  bet: number;
  lastBet: number;
  hands: Hand[];
  activeHand: number;
  dealer: Die[];
  busy: boolean;
  message: string | null;
  /** Čistý zisk/ztráta posledního kola. */
  net: number | null;
  loans: number;
  round: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function loadSaved(): { bankroll: number; loans: number; lastBet: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<{ bankroll: number; loans: number; lastBet: number }>;
      if (typeof p.bankroll === 'number' && Number.isFinite(p.bankroll) && p.bankroll >= 0) {
        return {
          bankroll: Math.floor(p.bankroll),
          loans: typeof p.loans === 'number' ? p.loans : 0,
          lastBet: typeof p.lastBet === 'number' ? p.lastBet : 0,
        };
      }
    }
  } catch {
    /* localStorage nedostupné */
  }
  return { bankroll: STARTING_BANKROLL, loans: 0, lastBet: 0 };
}

function createInitial(): GameState {
  const saved = loadSaved();
  return {
    phase: 'betting',
    bankroll: saved.bankroll,
    bet: 0,
    lastBet: saved.lastBet,
    hands: [],
    activeHand: 0,
    dealer: [],
    busy: false,
    message: null,
    net: null,
    loans: saved.loans,
    round: 0,
  };
}

const mapDice = (s: GameState, fn: (d: Die) => Die): GameState => ({
  ...s,
  dealer: s.dealer.map(fn),
  hands: s.hands.map((h) => ({ ...h, dice: h.dice.map(fn) })),
});

const patchHand = (s: GameState, index: number, patch: Partial<Hand>): GameState => ({
  ...s,
  hands: s.hands.map((h, i) => (i === index ? { ...h, ...patch } : h)),
});

export function useDiceJack() {
  const [state, setState] = useState<GameState>(createInitial);
  const ref = useRef(state);

  /** Synchronní update: ref je vždy aktuální i uvnitř async sekvencí. */
  const update = useCallback((fn: (s: GameState) => GameState) => {
    ref.current = fn(ref.current);
    setState(ref.current);
  }, []);

  // Ukládání bankrollu (jen mimo rozehrané kolo – reload uprostřed kola vrátí vklad).
  useEffect(() => {
    if (state.phase !== 'betting' && state.phase !== 'settled') return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ bankroll: state.bankroll + state.bet, loans: state.loans, lastBet: state.lastBet }),
      );
    } catch {
      /* ignorovat */
    }
  }, [state.phase, state.bankroll, state.bet, state.loans, state.lastBet]);

  // ---------- Pomocné animační kroky ----------

  /** Hodí jednu kostku do ruky (index) nebo krupiérovi a počká na dopad. */
  const roll = useCallback(
    async (target: number | 'dealer', hidden = false): Promise<Die> => {
      const die = newDie(undefined, hidden);
      update((s) =>
        target === 'dealer'
          ? { ...s, dealer: [...s.dealer, die] }
          : patchHand(s, target, { dice: [...s.hands[target].dice, die] }),
      );
      playDiceRoll(1);
      await sleep(ROLL_MS);
      update((s) => mapDice(s, (d) => (d.id === die.id ? { ...d, settled: true } : d)));
      return die;
    },
    [update],
  );

  const revealHole = useCallback(async () => {
    if (!ref.current.dealer.some((d) => d.hidden)) return;
    playReveal();
    update((s) => ({ ...s, dealer: s.dealer.map((d) => ({ ...d, hidden: false })) }));
    await sleep(550);
  }, [update]);

  const settle = useCallback(() => {
    const s = ref.current;
    const dealerNatural = isNatural(s.dealer);
    const hands = s.hands.map((h) => settleHand(h, s.dealer, dealerNatural));
    const staked = hands.reduce((a, h) => a + h.bet, 0);
    const payout = hands.reduce((a, h) => a + (h.payout ?? 0), 0);
    const net = payout - staked;

    let message: string;
    if (hands.some((h) => h.outcome === 'dicejack')) message = 'DiceJack!';
    else if (dealerNatural && hands.every((h) => h.outcome === 'lose')) message = 'Krupiér má DiceJack';
    else if (hands.every((h) => h.outcome === 'bust')) message = 'Tropa!';
    else if (total(s.dealer) > 12 && net > 0) message = 'Krupiér přetáhl!';
    else if (net > 0) message = 'Výhra!';
    else if (net < 0) message = 'Prohra';
    else message = hands.length > 1 ? 'Vyrovnáno' : 'Remíza';

    if (hands.some((h) => h.outcome === 'dicejack')) playDiceJack();
    else if (net > 0) playWin();
    else if (net < 0) {
      if (!hands.every((h) => h.outcome === 'bust')) playLose();
    } else playPush();

    update((st) => ({
      ...st,
      hands,
      bankroll: st.bankroll + payout,
      net,
      message,
      phase: 'settled',
      busy: false,
    }));
  }, [update]);

  const dealerTurn = useCallback(async () => {
    update((s) => ({ ...s, phase: 'dealer', busy: true, message: null }));
    await sleep(350);
    await revealHole();
    const anyAlive = ref.current.hands.some((h) => h.status !== 'bust');
    if (anyAlive) {
      while (dealerShouldHit(ref.current.dealer)) {
        await sleep(250);
        await roll('dealer');
      }
      await sleep(300);
    }
    settle();
  }, [update, revealHole, roll, settle]);

  /** Přejde na další nedohranou ruku, nebo předá tah krupiérovi. */
  const advance = useCallback(async () => {
    const s = ref.current;
    const next = s.hands.findIndex((h, i) => i >= s.activeHand && h.status === 'playing');
    if (next !== -1) {
      update((st) => ({ ...st, activeHand: next, busy: false }));
      return;
    }
    await dealerTurn();
  }, [update, dealerTurn]);

  /** Po přihození: tropa / přesně 12 = automatický konec ruky. */
  const resolveAfterDraw = useCallback(
    (index: number, forceStand: boolean) => {
      const h = ref.current.hands[index];
      const sum = total(h.dice);
      if (sum > 12) {
        playBust();
        update((s) => patchHand(s, index, { status: 'bust' }));
      } else if (sum === 12 || forceStand) {
        update((s) => patchHand(s, index, { status: 'stood' }));
      }
    },
    [update],
  );

  // ---------- Sázení ----------

  const addChip = useCallback(
    (value: number) => {
      const s = ref.current;
      if (s.phase !== 'betting' || s.busy) return;
      const amount = Math.min(value, s.bankroll);
      if (amount <= 0) return;
      playChip();
      update((st) => ({ ...st, bankroll: st.bankroll - amount, bet: st.bet + amount }));
    },
    [update],
  );

  const allIn = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'betting' || s.busy || s.bankroll <= 0) return;
    playChip();
    update((st) => ({ ...st, bet: st.bet + st.bankroll, bankroll: 0 }));
  }, [update]);

  const clearBet = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'betting' || s.busy || s.bet === 0) return;
    playChip();
    update((st) => ({ ...st, bankroll: st.bankroll + st.bet, bet: 0 }));
  }, [update]);

  // ---------- Rozdání ----------

  const deal = useCallback(async () => {
    const s = ref.current;
    if (s.phase !== 'betting' || s.busy || s.bet < Math.min(MIN_BET, s.bet + s.bankroll) || s.bet <= 0) return;

    const hand: Hand = { id: uid('hand'), dice: [], bet: s.bet, doubled: false, fromSplit: false, status: 'playing' };
    update((st) => ({
      ...st,
      phase: 'dealing',
      busy: true,
      lastBet: st.bet,
      bet: 0,
      hands: [hand],
      activeHand: 0,
      dealer: [],
      net: null,
      message: null,
      round: st.round + 1,
    }));

    // Střídavě hráč / krupiér, s mírným překryvem animací.
    const p1 = roll(0);
    await sleep(220);
    const d1 = roll('dealer');
    await sleep(220);
    const p2 = roll(0);
    await sleep(220);
    const d2 = roll('dealer', true);
    await Promise.all([p1, d1, p2, d2]);
    await sleep(200);

    const cur = ref.current;
    const playerNatural = isNatural(cur.hands[0].dice);
    const dealerNatural = isNatural(cur.dealer);

    if (playerNatural) {
      update((st) => patchHand({ ...st, message: 'DiceJack! Krupiér odkrývá…' }, 0, { status: 'dicejack' }));
      await sleep(500);
      await revealHole();
      settle();
      return;
    }

    // Krupiér s viditelnou šestkou nahlíží pod kelímek (ochrana proti zbytečnému Double/Split).
    if (cur.dealer[0].value === 6) {
      update((st) => ({ ...st, message: 'Krupiér nahlíží pod kelímek…' }));
      await sleep(900);
      if (dealerNatural) {
        await revealHole();
        settle();
        return;
      }
      update((st) => ({ ...st, message: null }));
    }

    update((st) => ({ ...st, phase: 'player', busy: false }));
  }, [update, roll, revealHole, settle]);

  // ---------- Akce hráče ----------

  const playable = () => {
    const s = ref.current;
    const h = s.hands[s.activeHand];
    return s.phase === 'player' && !s.busy && h && h.status === 'playing' ? h : null;
  };

  const hit = useCallback(async () => {
    if (!playable()) return;
    const index = ref.current.activeHand;
    update((s) => ({ ...s, busy: true }));
    await roll(index);
    resolveAfterDraw(index, false);
    if (ref.current.hands[index].status === 'playing') {
      update((s) => ({ ...s, busy: false }));
    } else {
      await sleep(350);
      await advance();
    }
  }, [update, roll, resolveAfterDraw, advance]);

  const stand = useCallback(async () => {
    if (!playable()) return;
    const index = ref.current.activeHand;
    update((s) => patchHand({ ...s, busy: true }, index, { status: 'stood' }));
    await sleep(150);
    await advance();
  }, [update, advance]);

  const doubleDown = useCallback(async () => {
    const h = playable();
    if (!h || !canDouble(h, ref.current.bankroll)) return;
    const index = ref.current.activeHand;
    playChip();
    update((s) =>
      patchHand({ ...s, busy: true, bankroll: s.bankroll - h.bet }, index, { bet: h.bet * 2, doubled: true }),
    );
    await sleep(250);
    await roll(index);
    resolveAfterDraw(index, true);
    await sleep(400);
    await advance();
  }, [update, roll, resolveAfterDraw, advance]);

  const split = useCallback(async () => {
    const s0 = ref.current;
    const h = playable();
    if (!h || !canSplit(s0.hands, h, s0.bankroll)) return;
    playChip();
    const [a, b] = h.dice;
    const left: Hand = { id: uid('hand'), dice: [a], bet: h.bet, doubled: false, fromSplit: true, status: 'playing' };
    const right: Hand = { id: uid('hand'), dice: [b], bet: h.bet, doubled: false, fromSplit: true, status: 'playing' };
    update((s) => ({ ...s, busy: true, bankroll: s.bankroll - h.bet, hands: [left, right], activeHand: 0 }));
    await sleep(350);
    const r1 = roll(0);
    await sleep(200);
    const r2 = roll(1);
    await Promise.all([r1, r2]);
    resolveAfterDraw(0, false);
    resolveAfterDraw(1, false);
    update((s) => ({ ...s, activeHand: 0 }));
    await advance();
  }, [update, roll, resolveAfterDraw, advance]);

  // ---------- Další kolo / půjčka ----------

  const nextRound = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'settled') return;
    const rebet = s.lastBet > 0 && s.lastBet <= s.bankroll ? s.lastBet : 0;
    update((st) => ({
      ...st,
      phase: 'betting',
      hands: [],
      dealer: [],
      activeHand: 0,
      net: null,
      message: null,
      bet: rebet,
      bankroll: st.bankroll - rebet,
    }));
  }, [update]);

  const takeLoan = useCallback(() => {
    const s = ref.current;
    if (s.busy || (s.phase !== 'betting' && s.phase !== 'settled')) return;
    playChip();
    update((st) => ({
      ...st,
      phase: 'betting',
      bankroll: STARTING_BANKROLL,
      bet: 0,
      hands: [],
      dealer: [],
      activeHand: 0,
      net: null,
      message: null,
      loans: st.loans + 1,
    }));
  }, [update]);

  // ---------- Odvozené hodnoty pro UI ----------

  const derived = useMemo(() => {
    const active = state.phase === 'player' ? state.hands[state.activeHand] : undefined;
    const idle = state.phase === 'player' && !state.busy && active?.status === 'playing';
    const funds = state.bankroll + state.bet;
    return {
      canHit: !!idle,
      canStand: !!idle,
      canDouble: !!idle && !!active && canDouble(active, state.bankroll),
      canSplit: !!idle && !!active && canSplit(state.hands, active, state.bankroll),
      canDeal: state.phase === 'betting' && !state.busy && state.bet > 0 && state.bet >= Math.min(MIN_BET, funds),
      isBroke:
        (state.phase === 'betting' && funds < MIN_BET) || (state.phase === 'settled' && state.bankroll < MIN_BET),
      totalStake: state.hands.reduce((a, h) => a + h.bet, 0),
    };
  }, [state]);

  return {
    state,
    ...derived,
    actions: { addChip, allIn, clearBet, deal, hit, stand, doubleDown, split, nextRound, takeLoan },
  };
}

export type DiceJackGame = ReturnType<typeof useDiceJack>;

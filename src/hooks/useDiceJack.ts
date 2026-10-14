import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHARLIE_DICE,
  HOT_STREAK_AT,
  HOT_STREAK_BONUS,
  MIN_BET,
  PAIR_PAYOUT,
  STARTING_BANKROLL,
  TARGET,
  canDouble,
  canSafeHit,
  canSplit,
  dealerShouldHit,
  isNatural,
  isPair,
  newDie,
  safeHitCost,
  score,
  settleHand,
  uid,
  type Die,
  type DieKind,
  type Hand,
  type Phase,
} from '../lib/gameRules';
import { hapticBust, hapticTap, hapticWin } from '../lib/haptics';
import {
  playBust,
  playChip,
  playCharlie,
  playDiceJack,
  playDiceRoll,
  playHotStreak,
  playLose,
  playMetalDie,
  playPairWin,
  playPush,
  playReveal,
  playWin,
} from '../lib/soundEffects';

/** Délka animace hodu – musí odpovídat komponentě Die. */
export const ROLL_MS = 650;
const STORAGE_KEY = 'dicejack12:v2';
const LEGACY_KEY = 'dicejack12:v1';

export type BetTarget = 'main' | 'side';

export interface Flash {
  id: number;
  text: string;
  sub?: string;
  tone: 'charlie' | 'pair' | 'streak' | 'info';
}

export interface GameState {
  phase: Phase;
  /** Volné peníze hráče (sázky se z nich odečítají už při pokládání žetonů). */
  bankroll: number;
  /** Rozpracovaná hlavní sázka ve fázi sázení. */
  bet: number;
  /** Rozpracovaná vedlejší sázka „Pár“. */
  sideBet: number;
  betTarget: BetTarget;
  lastBet: number;
  lastSideBet: number;
  hands: Hand[];
  activeHand: number;
  dealer: Die[];
  busy: boolean;
  message: string | null;
  flash: Flash | null;
  /** Vedlejší sázka aktuálního kola. */
  sideStake: number;
  sideResult: 'win' | 'lose' | null;
  /** Bezpečný příhoz (d3) už v tomto kole použit. */
  safeHitUsed: boolean;
  /** Poplatky zaplacené v kole (bezpečný příhoz). */
  fees: number;
  /** Bonus Hot Streak vyplacený v posledním kole. */
  bonus: number;
  /** Čistý zisk/ztráta posledního kola. */
  net: number | null;
  streak: number;
  highScore: number;
  rounds: number;
  loans: number;
  round: number;
}

interface Saved {
  bankroll: number;
  highScore: number;
  rounds: number;
  streak: number;
  loans: number;
  lastBet: number;
  lastSideBet: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);

function loadSaved(): Saved {
  const fallback: Saved = {
    bankroll: STARTING_BANKROLL,
    highScore: STARTING_BANKROLL,
    rounds: 0,
    streak: 0,
    loans: 0,
    lastBet: 0,
    lastSideBet: 0,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Record<keyof Saved, unknown>>;
    const bankroll = num(p.bankroll, STARTING_BANKROLL);
    return {
      bankroll,
      highScore: Math.max(bankroll, num(p.highScore, STARTING_BANKROLL)),
      rounds: num(p.rounds),
      streak: num(p.streak),
      loans: num(p.loans),
      lastBet: num(p.lastBet),
      lastSideBet: num(p.lastSideBet),
    };
  } catch {
    return fallback;
  }
}

function createInitial(): GameState {
  const s = loadSaved();
  return {
    phase: 'betting',
    bankroll: s.bankroll,
    bet: 0,
    sideBet: 0,
    betTarget: 'main',
    lastBet: s.lastBet,
    lastSideBet: s.lastSideBet,
    hands: [],
    activeHand: 0,
    dealer: [],
    busy: false,
    message: null,
    flash: null,
    sideStake: 0,
    sideResult: null,
    safeHitUsed: false,
    fees: 0,
    bonus: 0,
    net: null,
    streak: s.streak,
    highScore: s.highScore,
    rounds: s.rounds,
    loans: s.loans,
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
  const flashId = useRef(0);

  /** Synchronní update: ref je vždy aktuální i uvnitř async sekvencí. */
  const update = useCallback((fn: (s: GameState) => GameState) => {
    ref.current = fn(ref.current);
    setState(ref.current);
  }, []);

  // Ukládání postupu (jen mimo rozehrané kolo – reload uprostřed kola vrátí vklad).
  useEffect(() => {
    if (state.phase !== 'betting' && state.phase !== 'settled') return;
    const saved: Saved = {
      bankroll: state.bankroll + state.bet + state.sideBet,
      highScore: state.highScore,
      rounds: state.rounds,
      streak: state.streak,
      loans: state.loans,
      lastBet: state.lastBet,
      lastSideBet: state.lastSideBet,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* ignorovat */
    }
  }, [
    state.phase,
    state.bankroll,
    state.bet,
    state.sideBet,
    state.highScore,
    state.rounds,
    state.streak,
    state.loans,
    state.lastBet,
    state.lastSideBet,
  ]);

  /** Krátké oslavné hlášení uprostřed stolu. */
  const showFlash = useCallback(
    (text: string, tone: Flash['tone'], sub?: string, ms = 1700) => {
      const id = ++flashId.current;
      update((s) => ({ ...s, flash: { id, text, sub, tone } }));
      setTimeout(() => update((s) => (s.flash?.id === id ? { ...s, flash: null } : s)), ms);
    },
    [update],
  );

  // ---------- Pomocné animační kroky ----------

  /** Hodí jednu kostku do ruky (index) nebo krupiérovi a počká na dopad. */
  const roll = useCallback(
    async (target: number | 'dealer', hidden = false, kind: DieKind = 'd6'): Promise<Die> => {
      const die = newDie(kind, hidden);
      update((s) =>
        target === 'dealer'
          ? { ...s, dealer: [...s.dealer, die] }
          : patchHand(s, target, { dice: [...s.hands[target].dice, die] }),
      );
      playDiceRoll(1);
      await sleep(ROLL_MS);
      update((s) => mapDice(s, (d) => (d.id === die.id ? { ...d, settled: true } : d)));
      hapticTap();
      if (kind === 'd3') playMetalDie();
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
    const handsNet = payout - staked;

    // Hot Streak: push sérii neruší ani nezvyšuje.
    const hot = s.streak >= HOT_STREAK_AT;
    const bonus = handsNet > 0 && hot ? Math.max(1, Math.round(handsNet * HOT_STREAK_BONUS)) : 0;
    const streak = handsNet > 0 ? s.streak + 1 : handsNet < 0 ? 0 : s.streak;
    const sideNet = s.sideResult === 'win' ? s.sideStake * PAIR_PAYOUT : -s.sideStake;
    const net = handsNet + bonus + sideNet - s.fees;

    const has = (o: string) => hands.some((h) => h.outcome === o);
    let message: string;
    if (has('dicejack')) message = 'DiceJack!';
    else if (has('charlie') && handsNet > 0) message = '4-Kostkový Charlie!';
    else if (dealerNatural && hands.every((h) => h.outcome === 'lose')) message = 'Krupiér má DiceJack';
    else if (hands.every((h) => h.outcome === 'bust')) message = 'Tropa!';
    else if (score(s.dealer).hard > TARGET && handsNet > 0) message = 'Krupiér přetáhl!';
    else if (handsNet > 0) message = 'Výhra!';
    else if (handsNet < 0) message = 'Prohra';
    else message = hands.length > 1 ? 'Vyrovnáno' : 'Remíza';

    if (has('dicejack')) playDiceJack();
    else if (handsNet > 0) playWin();
    else if (handsNet < 0) {
      if (!hands.every((h) => h.outcome === 'bust')) playLose();
    } else playPush();
    if (handsNet > 0) hapticWin();

    const bankroll = s.bankroll + payout + bonus;
    update((st) => ({
      ...st,
      hands,
      bankroll,
      bonus,
      net,
      streak,
      rounds: st.rounds + 1,
      highScore: Math.max(st.highScore, bankroll),
      message,
      phase: 'settled',
      busy: false,
    }));

    if (streak === HOT_STREAK_AT && handsNet > 0) {
      playHotStreak();
      showFlash('Hot Streak!', 'streak', `Další výhry +${Math.round(HOT_STREAK_BONUS * 100)} % navíc`, 2200);
    }
  }, [update, showFlash]);

  const dealerTurn = useCallback(async () => {
    update((s) => ({ ...s, phase: 'dealer', busy: true, message: null }));
    await sleep(350);
    await revealHole();
    // Krupiér hraje jen proti rukám, které nejsou rozhodnuté (tropa/Charlie/DiceJack).
    const contested = ref.current.hands.some((h) => h.status === 'stood');
    if (contested) {
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

  /** Po přihození: tropa / Charlie / přesně 12 = automatický konec ruky. */
  const resolveAfterDraw = useCallback(
    (index: number, forceStand: boolean) => {
      const h = ref.current.hands[index];
      const sc = score(h.dice);
      if (sc.hard > TARGET) {
        playBust();
        hapticBust();
        update((s) => patchHand(s, index, { status: 'bust' }));
      } else if (h.dice.length >= CHARLIE_DICE) {
        playCharlie();
        hapticWin();
        update((s) => patchHand(s, index, { status: 'charlie' }));
        showFlash('4-Kostkový Charlie!', 'charlie', `Výhra 2:1 · ${h.bet * 2} $`);
      } else if (sc.best === TARGET || forceStand) {
        update((s) => patchHand(s, index, { status: 'stood' }));
      }
    },
    [update, showFlash],
  );

  // ---------- Sázení ----------

  const setBetTarget = useCallback(
    (target: BetTarget) => {
      if (ref.current.phase !== 'betting') return;
      update((s) => ({ ...s, betTarget: target }));
    },
    [update],
  );

  const addChip = useCallback(
    (value: number) => {
      const s = ref.current;
      if (s.phase !== 'betting' || s.busy) return;
      const amount = Math.min(value, s.bankroll);
      if (amount <= 0) return;
      playChip();
      hapticTap();
      update((st) =>
        st.betTarget === 'side'
          ? { ...st, bankroll: st.bankroll - amount, sideBet: st.sideBet + amount }
          : { ...st, bankroll: st.bankroll - amount, bet: st.bet + amount },
      );
    },
    [update],
  );

  const allIn = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'betting' || s.busy || s.bankroll <= 0) return;
    playChip();
    hapticTap();
    update((st) =>
      st.betTarget === 'side'
        ? { ...st, sideBet: st.sideBet + st.bankroll, bankroll: 0 }
        : { ...st, bet: st.bet + st.bankroll, bankroll: 0 },
    );
  }, [update]);

  const clearBet = useCallback(() => {
    const s = ref.current;
    if (s.phase !== 'betting' || s.busy || s.bet + s.sideBet === 0) return;
    playChip();
    update((st) => ({ ...st, bankroll: st.bankroll + st.bet + st.sideBet, bet: 0, sideBet: 0, betTarget: 'main' }));
  }, [update]);

  // ---------- Rozdání ----------

  const deal = useCallback(async () => {
    const s = ref.current;
    const funds = s.bankroll + s.bet + s.sideBet;
    if (s.phase !== 'betting' || s.busy || s.bet <= 0 || s.bet < Math.min(MIN_BET, funds)) return;

    const hand: Hand = { id: uid('hand'), dice: [], bet: s.bet, doubled: false, fromSplit: false, status: 'playing' };
    update((st) => ({
      ...st,
      phase: 'dealing',
      busy: true,
      lastBet: st.bet,
      lastSideBet: st.sideBet,
      sideStake: st.sideBet,
      sideResult: null,
      bet: 0,
      sideBet: 0,
      betTarget: 'main',
      hands: [hand],
      activeHand: 0,
      dealer: [],
      net: null,
      bonus: 0,
      fees: 0,
      safeHitUsed: false,
      message: null,
      flash: null,
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

    // Vedlejší sázka „Pár“ – vyhodnotí se hned po rozdání.
    const side = ref.current.sideStake;
    if (side > 0) {
      if (isPair(ref.current.hands[0].dice)) {
        const win = side * (PAIR_PAYOUT + 1);
        playPairWin();
        hapticWin();
        update((st) => ({ ...st, bankroll: st.bankroll + win, sideResult: 'win' }));
        showFlash('Pár!', 'pair', `Vedlejší sázka 4:1 · +${side * PAIR_PAYOUT} $`);
        await sleep(900);
      } else {
        update((st) => ({ ...st, sideResult: 'lose' }));
      }
    }

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
  }, [update, roll, revealHole, settle, showFlash]);

  // ---------- Akce hráče ----------

  const playable = () => {
    const s = ref.current;
    const h = s.hands[s.activeHand];
    return s.phase === 'player' && !s.busy && h && h.status === 'playing' ? h : null;
  };

  const drawAndContinue = useCallback(
    async (index: number, kind: DieKind) => {
      await roll(index, false, kind);
      resolveAfterDraw(index, false);
      if (ref.current.hands[index].status === 'playing') {
        update((s) => ({ ...s, busy: false }));
      } else {
        await sleep(ref.current.hands[index].status === 'charlie' ? 900 : 350);
        await advance();
      }
    },
    [update, roll, resolveAfterDraw, advance],
  );

  const hit = useCallback(async () => {
    if (!playable()) return;
    const index = ref.current.activeHand;
    update((s) => ({ ...s, busy: true }));
    await drawAndContinue(index, 'd6');
  }, [update, drawAndContinue]);

  /** Cinknutá kostka (Ostrostřelec): d3 za 50 % sázky, jednou za kolo. */
  const safeHit = useCallback(async () => {
    const h = playable();
    const s = ref.current;
    if (!h || !canSafeHit(h, s.bankroll, s.safeHitUsed)) return;
    const index = s.activeHand;
    const cost = safeHitCost(h);
    playChip();
    hapticTap();
    update((st) => ({ ...st, busy: true, safeHitUsed: true, bankroll: st.bankroll - cost, fees: st.fees + cost }));
    await sleep(200);
    await drawAndContinue(index, 'd3');
  }, [update, drawAndContinue]);

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
    hapticTap();
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
    hapticTap();
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
    const bet = s.lastBet > 0 && s.lastBet <= s.bankroll ? s.lastBet : 0;
    const side = bet > 0 && s.lastSideBet > 0 && s.lastSideBet <= s.bankroll - bet ? s.lastSideBet : 0;
    update((st) => ({
      ...st,
      phase: 'betting',
      hands: [],
      dealer: [],
      activeHand: 0,
      net: null,
      bonus: 0,
      message: null,
      flash: null,
      sideStake: 0,
      sideResult: null,
      betTarget: 'main',
      bet,
      sideBet: side,
      bankroll: st.bankroll - bet - side,
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
      sideBet: 0,
      betTarget: 'main',
      hands: [],
      dealer: [],
      activeHand: 0,
      net: null,
      bonus: 0,
      message: null,
      flash: null,
      sideStake: 0,
      sideResult: null,
      streak: 0,
      loans: st.loans + 1,
    }));
  }, [update]);

  // ---------- Odvozené hodnoty pro UI ----------

  const derived = useMemo(() => {
    const active = state.phase === 'player' ? state.hands[state.activeHand] : undefined;
    const idle = state.phase === 'player' && !state.busy && active?.status === 'playing';
    const funds = state.bankroll + state.bet + state.sideBet;
    const activeScore = active ? score(active.dice) : null;
    return {
      canHit: !!idle,
      canStand: !!idle,
      canDouble: !!idle && !!active && canDouble(active, state.bankroll),
      canSplit: !!idle && !!active && canSplit(state.hands, active, state.bankroll),
      /** Bezpečný příhoz se nabízí při součtu 8–10 (i když na něj chybí peníze). */
      offerSafeHit: !!idle && !state.safeHitUsed && !!activeScore && [8, 9, 10].includes(activeScore.best),
      canSafeHit: !!idle && !!active && canSafeHit(active, state.bankroll, state.safeHitUsed),
      safeHitCost: active ? safeHitCost(active) : 0,
      canDeal: state.phase === 'betting' && !state.busy && state.bet > 0 && state.bet >= Math.min(MIN_BET, funds),
      isBroke:
        (state.phase === 'betting' && funds < MIN_BET) || (state.phase === 'settled' && state.bankroll < MIN_BET),
      totalStake: state.hands.reduce((a, h) => a + h.bet, 0) + state.sideStake,
      hot: state.streak >= HOT_STREAK_AT,
    };
  }, [state]);

  return {
    state,
    ...derived,
    actions: {
      addChip,
      allIn,
      clearBet,
      setBetTarget,
      deal,
      hit,
      safeHit,
      stand,
      doubleDown,
      split,
      nextRound,
      takeLoan,
    },
  };
}

export type DiceJackGame = ReturnType<typeof useDiceJack>;

import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { formatMoney } from './components/AnimatedNumber';
import { ChipStack } from './components/Chip';
import { Controls } from './components/Controls';
import { DealerZone } from './components/DealerZone';
import { HandView } from './components/HandView';
import { Header } from './components/Header';
import { RulesModal } from './components/RulesModal';
import { useDiceJack } from './hooks/useDiceJack';
import { setSoundEnabled, unlockAudio } from './lib/soundEffects';

const SOUND_KEY = 'dicejack12:sound';

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

/** Velikost kostky podle výšky herní plochy. */
function useDieSize(ref: RefObject<HTMLDivElement | null>): number {
  const [size, setSize] = useState(52);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      const w = entry.contentRect.width;
      setSize(Math.round(Math.max(38, Math.min(64, h * 0.078, w * 0.15))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

export default function App() {
  const game = useDiceJack();
  const { state } = game;
  const [soundOn, setSoundOn] = useState(readSoundPref);
  const [rulesOpen, setRulesOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const dieSize = useDieSize(frameRef);

  useEffect(() => {
    setSoundEnabled(soundOn);
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
    } catch {
      /* ignorovat */
    }
  }, [soundOn]);

  // Audio na mobilech lze spustit jen po interakci uživatele.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // Oslava DiceJacku + haptika.
  const celebrated = useRef(0);
  useEffect(() => {
    if (state.phase !== 'settled' || celebrated.current === state.round) return;
    celebrated.current = state.round;
    const dj = state.hands.some((h) => h.outcome === 'dicejack');
    if (dj) {
      const colors = ['#fcd34d', '#f59e0b', '#ffffff', '#10b981'];
      void confetti({ particleCount: 140, spread: 80, origin: { y: 0.65 }, colors, disableForReducedMotion: true });
      setTimeout(
        () => void confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }),
        250,
      );
      setTimeout(
        () => void confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }),
        400,
      );
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (dj) navigator.vibrate([40, 40, 40, 40, 120]);
        else if ((state.net ?? 0) < 0) navigator.vibrate(120);
      } catch {
        /* ignorovat */
      }
    }
  }, [state.phase, state.round, state.hands, state.net]);

  const toggleSound = useCallback(() => setSoundOn((v) => !v), []);
  const stake = state.phase === 'betting' ? state.bet : game.totalStake;
  const isSplit = state.hands.length > 1;
  const showTable = state.phase !== 'betting';

  return (
    <div className="app-shell">
      <div ref={frameRef} className="phone-frame felt relative flex flex-col overflow-hidden text-white">
        <Header
          bankroll={state.bankroll}
          stake={stake}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          onOpenRules={() => setRulesOpen(true)}
        />

        <main className="relative flex min-h-0 flex-1 flex-col justify-between px-3 pb-1">
          {/* Krupiér */}
          <div className="pt-1">
            <DealerZone dice={state.dealer} dieSize={dieSize} thinking={state.phase === 'dealer'} />
          </div>

          {/* Střed stolu: logo / zprávy / výsledek */}
          <div className="relative flex min-h-[4.5rem] flex-1 items-center justify-center">
            <TableLogo faded={showTable} />
            <AnimatePresence mode="wait">
              {state.phase === 'settled' && state.message ? (
                <ResultBanner key={`res-${state.round}`} message={state.message} net={state.net ?? 0} />
              ) : state.message ? (
                <motion.div
                  key={state.message}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="relative rounded-full bg-black/45 px-4 py-1.5 text-sm font-bold text-amber-200 ring-1 ring-amber-300/30"
                >
                  {state.message}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Hráč */}
          <section aria-label="Vaše ruce" className="flex min-h-0 flex-col items-center gap-1">
            {state.phase === 'betting' ? (
              <BetSpot amount={state.bet} />
            ) : (
              <div className={`flex w-full items-start justify-center ${isSplit ? 'gap-2' : ''}`}>
                {state.hands.map((h, i) => (
                  <HandView
                    key={h.id}
                    hand={h}
                    index={i}
                    isSplit={isSplit}
                    active={state.phase === 'player' && i === state.activeHand}
                    dieSize={dieSize}
                  />
                ))}
              </div>
            )}
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/70">Vy</div>
          </section>
        </main>

        <footer className="rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-slate-950/70 to-slate-950/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,.35)]">
          <Controls game={game} />
        </footer>

        <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      </div>
    </div>
  );
}

function TableLogo({ faded }: { faded: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${faded ? 'opacity-[0.12]' : 'opacity-100'}`}
    >
      <div className="font-serif text-3xl font-black italic tracking-tight text-amber-300 drop-shadow-[0_2px_0_rgba(0,0,0,.4)]">
        DiceJack <span className="text-white">12</span>
      </div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-100/60">
        DiceJack platí 2 : 1 · Krupiér stojí na 9
      </div>
    </div>
  );
}

function BetSpot({ amount }: { amount: number }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-2">
      <div className="grid size-28 place-items-center rounded-full border-2 border-dashed border-amber-200/40 bg-black/15 shadow-[inset_0_0_25px_rgba(0,0,0,.35)]">
        {amount > 0 ? (
          <ChipStack amount={amount} size={48} />
        ) : (
          <span className="px-4 text-center text-xs font-semibold text-emerald-100/50">Položte žetony</span>
        )}
      </div>
      <motion.div
        key={amount}
        initial={{ scale: 1.25 }}
        animate={{ scale: 1 }}
        className="text-lg font-black tabular-nums text-amber-200"
      >
        {formatMoney(amount)}
      </motion.div>
    </div>
  );
}

function ResultBanner({ message, net }: { message: string; net: number }) {
  const tone =
    message === 'DiceJack!'
      ? 'from-yellow-200 via-amber-400 to-amber-600 text-amber-950'
      : net > 0
        ? 'from-emerald-300 to-emerald-600 text-emerald-950'
        : net < 0
          ? 'from-rose-500 to-red-700 text-white'
          : 'from-slate-200 to-slate-400 text-slate-900';
  return (
    <motion.div
      initial={{ scale: 0.4, opacity: 0, rotate: -6 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 16 }}
      className={`relative rounded-2xl bg-gradient-to-b px-6 py-2 text-center shadow-2xl ring-2 ring-white/40 ${tone}`}
      role="status"
    >
      <div className="text-2xl font-black uppercase tracking-wide">{message}</div>
      <div className="text-sm font-bold tabular-nums">
        {net > 0 ? `+${formatMoney(net)}` : net < 0 ? `−${formatMoney(-net)}` : 'Vklad se vrací'}
      </div>
    </motion.div>
  );
}

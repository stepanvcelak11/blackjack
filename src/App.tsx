import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { formatMoney } from './components/AnimatedNumber';
import { ChipStack } from './components/Chip';
import { Controls, type HoldHandlers } from './components/Controls';
import { DealerZone } from './components/DealerZone';
import { DieFace } from './components/Die';
import { HandView } from './components/HandView';
import { Header } from './components/Header';
import { RulesModal } from './components/RulesModal';
import { useDiceJack, type BetTarget, type Flash, type GameState } from './hooks/useDiceJack';
import { hapticTap } from './lib/haptics';
import { setSoundEnabled, startRattle, unlockAudio } from './lib/soundEffects';

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
      setSize(Math.round(Math.max(36, Math.min(62, h * 0.072, w * 0.15))));
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
  const [shaking, setShaking] = useState(false);
  const stopRattle = useRef<(() => void) | null>(null);
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

  // „Podrž a zatřes“ – dokud je prst na tlačítku, kostky se třesou a štěrchají.
  const hold = useMemo<HoldHandlers>(
    () => ({
      onHoldStart: () => {
        unlockAudio();
        stopRattle.current?.();
        stopRattle.current = startRattle();
        hapticTap();
        setShaking(true);
      },
      onHoldEnd: () => {
        stopRattle.current?.();
        stopRattle.current = null;
        setShaking(false);
      },
    }),
    [],
  );
  useEffect(() => () => stopRattle.current?.(), []);

  // Konfety pro DiceJack a 4-Kostkového Charlieho.
  const celebrated = useRef(0);
  useEffect(() => {
    if (state.phase !== 'settled' || celebrated.current === state.round) return;
    celebrated.current = state.round;
    const dj = state.hands.some((h) => h.outcome === 'dicejack');
    const charlie = state.hands.some((h) => h.outcome === 'charlie');
    if (!dj && !charlie) return;
    const colors = dj ? ['#fcd34d', '#f59e0b', '#ffffff', '#10b981'] : ['#e879f9', '#a855f7', '#fcd34d', '#ffffff'];
    void confetti({ particleCount: 140, spread: 80, origin: { y: 0.65 }, colors, disableForReducedMotion: true });
    setTimeout(() => void confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }), 250);
    setTimeout(() => void confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }), 400);
  }, [state.phase, state.round, state.hands]);

  const toggleSound = useCallback(() => setSoundOn((v) => !v), []);
  const stake = state.phase === 'betting' ? state.bet + state.sideBet : game.totalStake;
  const isSplit = state.hands.length > 1;
  const showTable = state.phase !== 'betting';
  const shakeCount = state.phase === 'betting' ? 2 : 1;

  return (
    <div className="app-shell">
      <div ref={frameRef} className="phone-frame felt relative flex flex-col overflow-hidden text-white">
        <Header
          bankroll={state.bankroll}
          stake={stake}
          streak={state.streak}
          hot={game.hot}
          highScore={state.highScore}
          rounds={state.rounds}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          onOpenRules={() => setRulesOpen(true)}
        />

        <main className="relative flex min-h-0 flex-1 flex-col justify-between px-3 pb-1">
          {/* Krupiér */}
          <div className="pt-1">
            <DealerZone dice={state.dealer} dieSize={dieSize} thinking={state.phase === 'dealer'} />
          </div>

          {/* Střed stolu: logo / zprávy / výsledek / třesení */}
          <div className="relative flex min-h-[4.5rem] flex-1 items-center justify-center">
            <TableLogo faded={showTable || shaking} />
            <AnimatePresence mode="wait">
              {shaking ? (
                <ShakerCup key="shaker" dice={shakeCount} size={Math.round(dieSize * 0.7)} />
              ) : state.flash ? (
                <FlashBanner key={`flash-${state.flash.id}`} flash={state.flash} />
              ) : state.phase === 'settled' && state.message ? (
                <ResultBanner key={`res-${state.round}`} state={state} />
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
              <BetSpots
                main={state.bet}
                side={state.sideBet}
                target={state.betTarget}
                onSelect={game.actions.setBetTarget}
              />
            ) : (
              <>
                {state.sideStake > 0 && <SideBetChip amount={state.sideStake} result={state.sideResult} />}
                <div className={`flex w-full items-start justify-center ${isSplit ? 'gap-2' : ''}`}>
                  {state.hands.map((h, i) => {
                    const active = state.phase === 'player' && i === state.activeHand;
                    return (
                      <HandView
                        key={h.id}
                        hand={h}
                        index={i}
                        isSplit={isSplit}
                        active={active}
                        shaking={shaking && active}
                        dieSize={dieSize}
                      />
                    );
                  })}
                </div>
              </>
            )}
            <div className="text-xs font-bold tracking-[0.2em] text-emerald-100/70 uppercase">Vy</div>
          </section>
        </main>

        <footer className="rounded-t-3xl border-t border-white/10 bg-gradient-to-b from-slate-950/70 to-slate-950/95 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,.35)]">
          <Controls game={game} hold={hold} />
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
      <div className="font-serif text-3xl font-black tracking-tight text-amber-300 italic drop-shadow-[0_2px_0_rgba(0,0,0,.4)]">
        DiceJack <span className="text-white">12</span>
      </div>
      <div className="mt-0.5 text-[10px] font-bold tracking-[0.25em] text-emerald-100/60 uppercase">
        DiceJack 2 : 1 · Charlie 2 : 1 · Pár 4 : 1
      </div>
    </div>
  );
}

/** Kelímek, který se při podržení tlačítka zuřivě třese. */
function ShakerCup({ dice, size }: { dice: number; size: number }) {
  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ scale: 0.6, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 30, transition: { duration: 0.15 } }}
      aria-label="Třesení kostkami"
    >
      <div className="shake-hard relative" style={{ width: size * 2.4, height: size * 2.2 }}>
        <div className="absolute inset-x-0 top-0 flex justify-center gap-1">
          {Array.from({ length: dice }, (_, i) => (
            <div key={i} className={i % 2 ? 'dice-jump-b' : 'dice-jump-a'}>
              <DieFace value={i % 2 ? 5 : 1} size={size * 0.8} />
            </div>
          ))}
        </div>
        <svg viewBox="0 0 100 100" className="absolute bottom-0 left-0 w-full" style={{ height: size * 1.7 }}>
          <defs>
            <linearGradient id="shakerBody" x1="0" x2="1">
              <stop offset="0" stopColor="#3b0d0d" />
              <stop offset="0.4" stopColor="#991b1b" />
              <stop offset="1" stopColor="#2a0808" />
            </linearGradient>
          </defs>
          <ellipse cx="50" cy="12" rx="42" ry="9" fill="#1c0505" />
          <path d="M8 12 L18 92 Q19 97 25 97 H75 Q81 97 82 92 L92 12 Z" fill="url(#shakerBody)" />
          <ellipse cx="50" cy="12" rx="42" ry="9" fill="none" stroke="#fcd34d" strokeWidth="4" />
          <path d="M14 30 H86" stroke="#fbbf24" strokeOpacity=".5" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M26 22 L32 88" stroke="#fff" strokeOpacity=".18" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-1 animate-pulse text-xs font-black tracking-widest text-amber-200 uppercase">
        Pusť pro hod!
      </div>
    </motion.div>
  );
}

const FLASH_TONES: Record<Flash['tone'], string> = {
  charlie: 'from-fuchsia-400 via-purple-500 to-violet-700 text-white ring-fuchsia-200/70',
  pair: 'from-pink-300 via-fuchsia-400 to-purple-600 text-white ring-pink-100/70',
  streak: 'from-yellow-300 via-orange-500 to-red-600 text-white ring-orange-200/70',
  info: 'from-slate-200 to-slate-400 text-slate-900 ring-white/40',
};

function FlashBanner({ flash }: { flash: Flash }) {
  return (
    <motion.div
      initial={{ scale: 0.2, opacity: 0, rotate: -10 }}
      animate={{ scale: [0.2, 1.15, 1], opacity: 1, rotate: [-10, 4, 0] }}
      exit={{ scale: 1.3, opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.5 }}
      className={`relative rounded-2xl bg-gradient-to-br px-5 py-2 text-center shadow-2xl ring-2 ${FLASH_TONES[flash.tone]}`}
      role="status"
    >
      <motion.div
        className="text-2xl font-black tracking-wide uppercase"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      >
        {flash.text}
      </motion.div>
      {flash.sub && <div className="text-xs font-bold opacity-90">{flash.sub}</div>}
    </motion.div>
  );
}

function BetSpots({
  main,
  side,
  target,
  onSelect,
}: {
  main: number;
  side: number;
  target: BetTarget;
  onSelect: (t: BetTarget) => void;
}) {
  return (
    <div className="flex items-end justify-center gap-4 py-1">
      <button
        type="button"
        onClick={() => onSelect('main')}
        aria-pressed={target === 'main'}
        aria-label="Hlavní sázka – vybrat pro žetony"
        className="flex flex-col items-center gap-1"
      >
        <div
          className={`grid size-28 place-items-center rounded-full border-2 border-dashed bg-black/15 shadow-[inset_0_0_25px_rgba(0,0,0,.35)] transition-all ${target === 'main' ? 'border-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,.25),inset_0_0_25px_rgba(0,0,0,.35)]' : 'border-amber-200/30'}`}
        >
          {main > 0 ? (
            <ChipStack amount={main} size={48} />
          ) : (
            <span className="px-4 text-center text-xs font-semibold text-emerald-100/50">Položte žetony</span>
          )}
        </div>
        <motion.div
          key={main}
          initial={{ scale: 1.25 }}
          animate={{ scale: 1 }}
          className="text-lg font-black text-amber-200 tabular-nums"
        >
          {formatMoney(main)}
        </motion.div>
      </button>
      <button
        type="button"
        onClick={() => onSelect('side')}
        aria-pressed={target === 'side'}
        aria-label="Sázka na pár, výplata 4:1 – vybrat pro žetony"
        className="mb-1 flex flex-col items-center gap-1"
      >
        <div
          className={`relative grid size-[4.5rem] place-items-center rounded-full border-2 border-dashed bg-fuchsia-950/30 transition-all ${target === 'side' ? 'border-fuchsia-300 shadow-[0_0_0_3px_rgba(240,171,252,.25)]' : 'border-fuchsia-300/30'}`}
        >
          {side > 0 ? (
            <ChipStack amount={side} size={34} />
          ) : (
            <span className="text-center text-[10px] leading-tight font-bold text-fuchsia-100/70">
              Sázka
              <br />
              na pár
            </span>
          )}
          <span className="absolute -top-2 rounded-full bg-fuchsia-500 px-1.5 text-[10px] font-black text-white">
            4:1
          </span>
        </div>
        <div className="text-sm font-black text-fuchsia-200 tabular-nums">{formatMoney(side)}</div>
      </button>
    </div>
  );
}

function SideBetChip({ amount, result }: { amount: number; result: GameState['sideResult'] }) {
  const cls =
    result === 'win'
      ? 'bg-fuchsia-500 text-white ring-pink-200'
      : result === 'lose'
        ? 'bg-black/30 text-slate-400 line-through ring-white/10'
        : 'bg-fuchsia-950/60 text-fuchsia-200 ring-fuchsia-300/40';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0, scale: result === 'win' ? [1, 1.2, 1] : 1 }}
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${cls}`}
    >
      Pár {formatMoney(amount)}
      {result === 'win' && ` → +${formatMoney(amount * 4)}`}
    </motion.div>
  );
}

function ResultBanner({ state }: { state: GameState }) {
  const { message, bonus } = state;
  const net = state.net ?? 0;
  const tone =
    message === 'DiceJack!'
      ? 'from-yellow-200 via-amber-400 to-amber-600 text-amber-950'
      : message === '4-Kostkový Charlie!'
        ? 'from-fuchsia-300 via-purple-500 to-violet-700 text-white'
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
      <div className="text-2xl font-black tracking-wide uppercase">{message}</div>
      <div className="text-sm font-bold tabular-nums">
        {net > 0 ? `+${formatMoney(net)}` : net < 0 ? `−${formatMoney(-net)}` : 'Vklad se vrací'}
      </div>
      {bonus > 0 && (
        <div className="mt-0.5 rounded-full bg-orange-600/90 px-2 text-[11px] font-black text-white">
          🔥 Hot Streak bonus +{formatMoney(bonus)}
        </div>
      )}
      {state.fees > 0 && (
        <div className="text-[10px] font-semibold opacity-75">vč. cinknuté kostky −{formatMoney(state.fees)}</div>
      )}
    </motion.div>
  );
}

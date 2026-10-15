import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Coins, Flame, GraduationCap, Trophy, Volume2, VolumeX, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import { AnimatedNumber, formatMoney } from './AnimatedNumber';

interface Props {
  bankroll: number;
  stake: number;
  streak: number;
  hot: boolean;
  highScore: number;
  rounds: number;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenRules: () => void;
  onOpenTrainer: () => void;
  trainerOn: boolean;
}

export function Header({
  bankroll,
  stake,
  streak,
  hot,
  highScore,
  rounds,
  soundOn,
  onToggleSound,
  onOpenRules,
  onOpenTrainer,
  trainerOn,
}: Props) {
  return (
    <header className="px-3 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <div className="relative min-w-0 flex-1">
            <AnimatePresence>{hot && <FlameAura key="flame" />}</AnimatePresence>
            <Stat
              icon={hot ? <Flame className="size-4 text-orange-400" /> : <Wallet className="size-4" />}
              label={hot ? 'Hot Streak' : 'Bankroll'}
              accent={hot ? 'text-orange-300' : 'text-emerald-300'}
              hot={hot}
            >
              <AnimatedNumber value={bankroll} format={formatMoney} />
            </Stat>
          </div>
          <div className="min-w-0 flex-1">
            <Stat icon={<Coins className="size-4" />} label="Sázka" accent="text-amber-300">
              <AnimatedNumber value={stake} format={formatMoney} />
            </Stat>
          </div>
        </div>
        <IconButton label={soundOn ? 'Vypnout zvuk' : 'Zapnout zvuk'} onClick={onToggleSound}>
          {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-slate-400" />}
        </IconButton>
        <IconButton label="Trenažér strategie" onClick={onOpenTrainer}>
          <GraduationCap className={`size-5 ${trainerOn ? 'text-emerald-400' : ''}`} />
        </IconButton>
        <IconButton label="Pravidla hry" onClick={onOpenRules}>
          <BookOpen className="size-5" />
        </IconButton>
      </div>
      <div className="mt-1 flex items-center justify-between px-1 text-[10px] font-bold tracking-wider text-emerald-100/60 uppercase">
        <span className="flex items-center gap-1">
          <Trophy className="size-3 text-amber-300/80" /> Rekord{' '}
          <span className="text-amber-200 tabular-nums">{formatMoney(highScore)}</span>
        </span>
        <span className={`flex items-center gap-1 ${hot ? 'text-orange-300' : ''}`}>
          <Flame className={`size-3 ${streak > 0 ? 'text-orange-400' : ''}`} /> Série{' '}
          <span className="tabular-nums">{streak}</span>
          {hot && <span className="rounded bg-orange-500 px-1 text-white">+20 %</span>}
        </span>
        <span>
          Kol <span className="text-slate-200 tabular-nums">{rounds}</span>
        </span>
      </div>
    </header>
  );
}

/** Plameny šlehající kolem bankrollu při Hot Streak. */
function FlameAura() {
  return (
    <motion.div
      className="pointer-events-none absolute -inset-1 z-0 rounded-2xl"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 rounded-2xl"
        animate={{
          boxShadow: [
            '0 0 10px 2px rgba(249,115,22,.75), 0 -6px 18px 2px rgba(239,68,68,.5)',
            '0 0 18px 4px rgba(251,191,36,.85), 0 -10px 26px 4px rgba(249,115,22,.6)',
            '0 0 10px 2px rgba(249,115,22,.75), 0 -6px 18px 2px rgba(239,68,68,.5)',
          ],
        }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
      />
      {Array.from({ length: 7 }, (_, i) => (
        <motion.span
          key={i}
          className="absolute -top-1 block rounded-full"
          style={{
            left: `${8 + i * 14}%`,
            width: 8,
            height: 14,
            background: 'radial-gradient(ellipse at 50% 80%, #fde047 0%, #f97316 50%, rgba(239,68,68,0) 75%)',
            filter: 'blur(.5px)',
          }}
          animate={{ y: [0, -10, -16], opacity: [0, 1, 0], scaleY: [0.6, 1.3, 0.8] }}
          transition={{ duration: 0.7 + (i % 3) * 0.15, repeat: Infinity, delay: i * 0.11, ease: 'easeOut' }}
        />
      ))}
    </motion.div>
  );
}

function Stat({
  icon,
  label,
  accent,
  hot,
  children,
}: {
  icon: ReactNode;
  label: string;
  accent: string;
  hot?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative z-10 min-w-0 rounded-xl px-2.5 py-1 ring-1 ${hot ? 'bg-gradient-to-b from-orange-950/90 to-black/70 ring-orange-400/70' : 'bg-black/30 ring-white/10'}`}
    >
      <div className={`flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase ${accent} opacity-90`}>
        {icon}
        {label}
      </div>
      <div className="truncate text-base font-black text-white tabular-nums">{children}</div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center rounded-xl bg-black/30 text-slate-100 ring-1 ring-white/10 transition active:scale-95 active:bg-black/50"
    >
      {children}
    </button>
  );
}

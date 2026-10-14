import { motion } from 'framer-motion';
import { bustChance, riskLevel } from '../lib/gameRules';
import { AnimatedNumber } from './AnimatedNumber';

const COLORS = {
  safe: 'bg-emerald-500/90 text-emerald-950 ring-emerald-300',
  warn: 'bg-amber-400 text-amber-950 ring-amber-200',
  danger: 'bg-orange-500 text-white ring-orange-300',
  perfect: 'bg-gradient-to-b from-yellow-200 to-amber-500 text-amber-950 ring-yellow-100 shadow-[0_0_18px_rgba(251,191,36,.7)]',
  bust: 'bg-red-600 text-white ring-red-300',
  neutral: 'bg-slate-800/90 text-slate-100 ring-slate-500',
} as const;

interface Props {
  value: number;
  /** Neutrální barva (krupiér) – bez indikátoru rizika. */
  neutral?: boolean;
  showRisk?: boolean;
  suffix?: string;
}

export function ScoreBadge({ value, neutral, showRisk, suffix }: Props) {
  const level = riskLevel(value);
  const cls = neutral && level !== 'bust' ? COLORS.neutral : COLORS[level];
  const chance = bustChance(value);
  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        key={level}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className={`min-w-11 rounded-full px-2.5 py-0.5 text-center text-lg font-black tabular-nums ring-2 transition-colors duration-300 ${cls}`}
      >
        {level === 'bust' ? (
          <>
            <AnimatedNumber value={value} />
            <span className="ml-1 text-xs font-bold uppercase">tropa</span>
          </>
        ) : (
          <AnimatedNumber value={value} />
        )}
        {suffix && <span className="ml-1 text-xs font-bold">{suffix}</span>}
      </motion.div>
      {showRisk && value > 0 && value < 12 && (
        <span
          className={`text-[11px] font-semibold leading-tight ${chance === 0 ? 'text-emerald-300' : chance >= 67 ? 'text-orange-300' : 'text-amber-200/90'}`}
        >
          riziko
          <br />
          {chance} %
        </span>
      )}
    </div>
  );
}

import { motion } from 'framer-motion';
import { bustChance, riskLevel, type Score } from '../lib/gameRules';
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
  score: Score;
  /** Neutrální barva (krupiér) – bez indikátoru rizika. */
  neutral?: boolean;
  showRisk?: boolean;
  suffix?: string;
}

export function ScoreBadge({ score, neutral, showRisk, suffix }: Props) {
  const level = riskLevel(score);
  const cls = neutral && level !== 'bust' ? COLORS.neutral : COLORS[level];
  const chance = bustChance(score);
  // Měkká ruka (dokud se nezafixuje): ukázat obě hodnoty, např. „5 / 8“.
  const showSoft = score.soft && score.best < 12;
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <motion.div
          key={level}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          className={`min-w-11 whitespace-nowrap rounded-full px-2.5 py-0.5 text-center text-lg font-black tabular-nums ring-2 transition-colors duration-300 ${cls}`}
          aria-label={showSoft ? `Měkká ${score.hard} nebo ${score.best}` : `Součet ${score.best}`}
        >
          {showSoft ? (
            <>
              <span className="text-base">
                <AnimatedNumber value={score.hard} />
              </span>
              <span className="mx-0.5 text-sm">/</span>
              <AnimatedNumber value={score.best} />
            </>
          ) : level === 'bust' ? (
            <>
              <AnimatedNumber value={score.hard} />
              <span className="ml-1 text-xs font-bold uppercase">tropa</span>
            </>
          ) : (
            <AnimatedNumber value={score.best} />
          )}
          {suffix && <span className="ml-1 text-xs font-bold">{suffix}</span>}
        </motion.div>
        {showSoft && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-2 -right-2 rounded-full bg-red-600 px-1.5 text-[9px] leading-4 font-black text-white uppercase ring-1 ring-amber-300"
          >
            Měkká
          </motion.span>
        )}
      </div>
      {showRisk && score.best < 12 && (
        <span
          className={`text-[11px] leading-tight font-semibold ${chance === 0 ? 'text-emerald-300' : chance >= 67 ? 'text-orange-300' : 'text-amber-200/90'}`}
        >
          riziko
          <br />
          {chance} %
        </span>
      )}
    </div>
  );
}

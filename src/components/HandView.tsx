import { AnimatePresence, motion } from 'framer-motion';
import { visibleScore, type Hand, type Outcome } from '../lib/gameRules';
import { formatMoney } from './AnimatedNumber';
import { Die } from './Die';
import { ScoreBadge } from './ScoreBadge';

const OUTCOME_LABEL: Record<Outcome, { text: string; cls: string }> = {
  dicejack: { text: 'DiceJack 2:1', cls: 'bg-gradient-to-r from-yellow-300 to-amber-500 text-amber-950' },
  charlie: { text: 'Charlie 2:1', cls: 'bg-gradient-to-r from-fuchsia-400 to-violet-600 text-white' },
  win: { text: 'Výhra', cls: 'bg-emerald-500 text-emerald-950' },
  push: { text: 'Remíza', cls: 'bg-slate-300 text-slate-900' },
  lose: { text: 'Prohra', cls: 'bg-red-600 text-white' },
  bust: { text: 'Tropa', cls: 'bg-red-700 text-white' },
};

interface Props {
  hand: Hand;
  index: number;
  isSplit: boolean;
  active: boolean;
  /** Hráč drží „Přihodit“ – kostky na stole se třesou. */
  shaking?: boolean;
  dieSize: number;
}

export function HandView({ hand, index, isSplit, active, shaking = false, dieSize }: Props) {
  const sc = visibleScore(hand.dice);
  const anySettled = hand.dice.some((d) => d.settled);
  const size = isSplit ? Math.round(dieSize * (hand.dice.length > 3 ? 0.62 : 0.74)) : hand.dice.length > 4 ? Math.round(dieSize * 0.82) : dieSize;
  const isDiceJack = hand.status === 'dicejack';
  const isCharlie = hand.status === 'charlie';
  const dimmed = isSplit && !active && hand.status === 'playing';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: dimmed ? 0.55 : 1, scale: active && isSplit ? 1.02 : 1 }}
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl px-2 py-2 transition-[box-shadow,background-color] duration-300 ${
        active && isSplit
          ? 'bg-emerald-300/10 shadow-[0_0_0_2px_rgba(252,211,77,.9),0_0_24px_rgba(252,211,77,.25)]'
          : isSplit
            ? 'bg-black/10 shadow-[0_0_0_1px_rgba(255,255,255,.08)]'
            : ''
      } ${hand.status === 'bust' ? 'grayscale-[.5]' : ''}`}
    >
      {isSplit && (
        <div className="flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-100/80">
          <span>{index === 0 ? 'Levá ruka' : 'Pravá ruka'}</span>
          {active && <span className="rounded bg-amber-300 px-1.5 text-amber-950">Na tahu</span>}
        </div>
      )}

      {isCharlie && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: [0, 1, 0.6],
            scale: [0.8, 1.06, 1],
            boxShadow: [
              '0 0 0 0 rgba(217,70,239,0)',
              '0 0 0 4px rgba(217,70,239,.9), 0 0 40px rgba(217,70,239,.7)',
              '0 0 0 2px rgba(217,70,239,.7), 0 0 22px rgba(217,70,239,.4)',
            ],
          }}
          transition={{ duration: 0.8 }}
        />
      )}
      <div
        className={`flex min-h-0 flex-wrap items-center justify-center gap-1.5 ${shaking ? 'shake-soft' : ''}`}
        style={{ minHeight: size }}
      >
        {hand.dice.map((d, i) => (
          <motion.div
            key={d.id}
            animate={isCharlie ? { y: [0, -14, 0], rotate: [0, i % 2 ? 10 : -10, 0] } : { y: 0, rotate: 0 }}
            transition={{ duration: 0.5, delay: isCharlie ? i * 0.08 : 0 }}
          >
            <Die die={d} size={size} gold={(isDiceJack || isCharlie) && d.settled} from="bottom" />
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {anySettled && <ScoreBadge score={sc} showRisk={active && hand.status === 'playing'} />}
        <span className="rounded-full bg-black/35 px-2 py-0.5 text-xs font-bold text-amber-200 tabular-nums">
          {formatMoney(hand.bet)}
          {hand.doubled && <span className="ml-1 text-amber-400">×2</span>}
        </span>
      </div>

      <AnimatePresence>
        {hand.outcome && (
          <motion.div
            initial={{ scale: 0, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: -4, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.1 * index }}
            className={`absolute -top-2 right-1 rounded-md px-2 py-0.5 text-xs font-black uppercase shadow-lg ${OUTCOME_LABEL[hand.outcome].cls}`}
          >
            {OUTCOME_LABEL[hand.outcome].text}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

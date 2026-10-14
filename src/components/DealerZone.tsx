import { AnimatePresence } from 'framer-motion';
import { isNatural, visibleScore, type Die as DieModel } from '../lib/gameRules';
import { DealerCup } from './DealerCup';
import { Die } from './Die';
import { ScoreBadge } from './ScoreBadge';

interface Props {
  dice: DieModel[];
  dieSize: number;
  thinking: boolean;
}

export function DealerZone({ dice, dieSize, thinking }: Props) {
  const sc = visibleScore(dice);
  const hidden = dice.some((d) => d.hidden);
  const natural = !hidden && isNatural(dice) && dice.every((d) => d.settled);
  const size = dice.length > 4 ? Math.round(dieSize * 0.8) : dieSize;

  return (
    <section className="flex flex-col items-center gap-2" aria-label="Krupiér">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/70">
        <span>Krupiér</span>
        {dice.some((d) => d.settled) && (
          <ScoreBadge score={sc} neutral suffix={hidden ? '+ ?' : undefined} />
        )}
        {thinking && <span className="animate-pulse normal-case tracking-normal text-amber-200">hází…</span>}
      </div>
      <div className="flex flex-wrap items-end justify-center gap-2" style={{ minHeight: dieSize + 8 }}>
        {dice.length === 0 && (
          <div
            className="grid place-items-center rounded-xl border-2 border-dashed border-emerald-200/15 text-[11px] font-semibold text-emerald-100/30"
            style={{ width: dieSize * 2 + 8, height: dieSize }}
          >
            čeká na sázku
          </div>
        )}
        {dice.map((d) => (
          <div key={d.id} className="relative" style={{ width: size, height: size }}>
            <Die die={d} size={size} from="top" gold={natural} />
            <AnimatePresence>{d.hidden && <DealerCup key="cup" size={size} />}</AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { Die as DieModel, DieValue } from '../lib/gameRules';

// Pozice teček v mřížce 3×3 (index 0–8).
const PIPS: Record<DieValue, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

interface FaceProps {
  value: DieValue | null;
  size: number;
  tone?: 'ivory' | 'gold';
}

export function DieFace({ value, size, tone = 'ivory' }: FaceProps) {
  const pip = Math.max(5, Math.round(size * 0.17));
  const pad = Math.round(size * 0.16);
  const isGold = tone === 'gold';
  return (
    <div
      className="relative grid grid-cols-3 grid-rows-3 place-items-center"
      style={{
        width: size,
        height: size,
        padding: pad,
        borderRadius: size * 0.22,
        background: isGold
          ? 'linear-gradient(145deg,#fde68a 0%,#f59e0b 55%,#b45309 100%)'
          : 'linear-gradient(145deg,#ffffff 0%,#f5f0e6 55%,#d9d0bf 100%)',
        boxShadow: isGold
          ? 'inset 0 2px 1px rgba(255,255,255,.7), inset 0 -4px 6px rgba(120,53,15,.45), 0 6px 14px rgba(0,0,0,.55), 0 0 18px rgba(251,191,36,.45)'
          : 'inset 0 2px 1px rgba(255,255,255,.9), inset 0 -4px 6px rgba(120,100,70,.35), 0 6px 14px rgba(0,0,0,.55)',
        border: isGold ? '1px solid #fcd34d' : '1px solid #e7dcc6',
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: pip,
            height: pip,
            opacity: value && PIPS[value].includes(i) ? 1 : 0,
            background:
              value === 1 && !isGold
                ? 'radial-gradient(circle at 35% 30%,#f87171,#b91c1c 70%)'
                : isGold
                  ? 'radial-gradient(circle at 35% 30%,#57534e,#0c0a09 70%)'
                  : 'radial-gradient(circle at 35% 30%,#44403c,#0c0a09 70%)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,.7)',
          }}
        />
      ))}
    </div>
  );
}

interface DieProps {
  die: DieModel;
  size: number;
  /** Zvýraznit (např. dvě šestky = DiceJack). */
  gold?: boolean;
  /** Směr příletu: hráč odspodu, krupiér shora. */
  from?: 'top' | 'bottom';
}

const randomFace = (): DieValue => (Math.floor(Math.random() * 6) + 1) as DieValue;

export function Die({ die, size, gold = false, from = 'bottom' }: DieProps) {
  const [flicker, setFlicker] = useState<DieValue>(randomFace);
  const spin = useMemo(() => (Math.random() > 0.5 ? 1 : -1) * (360 + Math.floor(Math.random() * 180)), []);

  // Během hodu rychle střídáme náhodné strany.
  useEffect(() => {
    if (die.settled) return;
    const t = setInterval(() => setFlicker(randomFace()), 70);
    return () => clearInterval(t);
  }, [die.settled]);

  const shown: DieValue | null = die.hidden ? null : die.settled ? die.value : flicker;

  return (
    <motion.div
      initial={{ y: from === 'top' ? -90 : 120, x: 0, rotate: spin, scale: 0.55, opacity: 0 }}
      animate={{
        y: [from === 'top' ? -90 : 120, 0, -8, 0],
        x: [0, -6, 5, 0],
        rotate: [spin, spin * 0.25, -8, 0],
        scale: [0.55, 1.08, 0.96, 1],
        opacity: 1,
      }}
      transition={{ duration: 0.62, ease: 'easeOut', times: [0, 0.55, 0.8, 1] }}
      style={{ width: size, height: size }}
      className="shrink-0"
    >
      <motion.div
        key={die.settled ? 'settled' : 'rolling'}
        initial={die.settled ? { scale: 1.15 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      >
        <DieFace value={shown} size={size} tone={gold ? 'gold' : 'ivory'} />
      </motion.div>
    </motion.div>
  );
}

import { motion } from 'framer-motion';

export const CHIP_STYLES: Record<string, { base: string; edge: string; text: string }> = {
  '10': { base: '#e2e8f0', edge: '#1e40af', text: '#1e3a8a' },
  '25': { base: '#dc2626', edge: '#fef2f2', text: '#fff' },
  '50': { base: '#2563eb', edge: '#eff6ff', text: '#fff' },
  '100': { base: '#18181b', edge: '#fbbf24', text: '#fcd34d' },
  allin: { base: '#7c3aed', edge: '#fde68a', text: '#fff' },
};

export function chipStyleFor(amount: number) {
  if (amount >= 100) return CHIP_STYLES['100'];
  if (amount >= 50) return CHIP_STYLES['50'];
  if (amount >= 25) return CHIP_STYLES['25'];
  return CHIP_STYLES['10'];
}

interface ChipFaceProps {
  label: string;
  styleKey: keyof typeof CHIP_STYLES | string;
  size: number;
}

export function ChipFace({ label, styleKey, size }: ChipFaceProps) {
  const s = CHIP_STYLES[styleKey] ?? CHIP_STYLES['10'];
  return (
    <div
      className="relative grid place-items-center rounded-full font-black"
      style={{
        width: size,
        height: size,
        background: `repeating-conic-gradient(${s.base} 0deg 22deg, ${s.edge} 22deg 30deg)`,
        boxShadow: '0 3px 0 rgba(0,0,0,.45), 0 6px 12px rgba(0,0,0,.45), inset 0 0 0 2px rgba(0,0,0,.15)',
      }}
    >
      <div
        className="grid place-items-center rounded-full"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          background: `radial-gradient(circle at 40% 35%, ${s.base}, ${s.base} 60%, rgba(0,0,0,.25))`,
          border: `2px dashed ${s.edge}`,
          color: s.text,
          fontSize: label.length > 3 ? size * 0.2 : size * 0.3,
          letterSpacing: '-0.02em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

interface ChipButtonProps {
  label: string;
  styleKey: string;
  disabled?: boolean;
  onClick: () => void;
  ariaLabel: string;
}

export function ChipButton({ label, styleKey, disabled, onClick, ariaLabel }: ChipButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.86, y: -6 }}
      className="rounded-full transition-opacity disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale"
    >
      <ChipFace label={label} styleKey={styleKey} size={56} />
    </motion.button>
  );
}

/** Rozloží částku na hromádku žetonů (max. 6 vizuálních). */
export function ChipStack({ amount, size = 44 }: { amount: number; size?: number }) {
  const chips: number[] = [];
  let rest = amount;
  for (const v of [100, 50, 25, 10]) {
    while (rest >= v && chips.length < 6) {
      chips.push(v);
      rest -= v;
    }
  }
  if (chips.length === 0 && amount > 0) chips.push(10);

  return (
    <div className="relative" style={{ width: size, height: size + (chips.length - 1) * 5 }}>
      {chips.map((v, i) => (
        <motion.div
          key={`${i}-${v}`}
          className="absolute left-0"
          style={{ bottom: i * 5 }}
          initial={{ y: -40, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          <ChipFace label={String(v)} styleKey={String(v)} size={size} />
        </motion.div>
      ))}
    </div>
  );
}

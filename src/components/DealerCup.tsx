import { motion } from 'framer-motion';

/** Kožený kelímek (obrácený dnem vzhůru), který zakrývá skrytou kostku krupiéra. */
export function DealerCup({ size }: { size: number }) {
  const w = size * 1.32;
  const h = size * 1.38;
  return (
    <motion.div
      className="pointer-events-none absolute z-10"
      style={{ width: w, height: h, left: (size - w) / 2, bottom: -size * 0.08 }}
      initial={{ y: -size * 1.6, opacity: 0, rotate: -10 }}
      animate={{ y: 0, opacity: 1, rotate: [0, -3, 3, -2, 0] }}
      exit={{ y: -size * 1.9, x: size * 0.5, rotate: 28, opacity: 0, transition: { duration: 0.45, ease: 'easeIn' } }}
      transition={{ y: { type: 'spring', stiffness: 260, damping: 20 }, rotate: { duration: 0.6, delay: 0.25 } }}
      aria-label="Skrytá kostka pod kelímkem"
    >
      <svg viewBox="0 0 100 104" width={w} height={h} className="drop-shadow-[0_8px_10px_rgba(0,0,0,.6)]">
        <defs>
          <linearGradient id="cupBody" x1="0" x2="1">
            <stop offset="0" stopColor="#3b0d0d" />
            <stop offset="0.35" stopColor="#7f1d1d" />
            <stop offset="0.55" stopColor="#991b1b" />
            <stop offset="1" stopColor="#2a0808" />
          </linearGradient>
          <linearGradient id="cupRim" x1="0" x2="1">
            <stop offset="0" stopColor="#78350f" />
            <stop offset="0.45" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#78350f" />
          </linearGradient>
        </defs>
        {/* tělo kelímku – užší nahoře (dno), širší dole (ústí) */}
        <path d="M24 6 H76 Q79 6 80 10 L92 90 H8 L20 10 Q21 6 24 6 Z" fill="url(#cupBody)" />
        {/* prošívání */}
        <path d="M27 14 H73" stroke="#fbbf24" strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="3 3" />
        <path d="M14 78 H86" stroke="#fbbf24" strokeOpacity=".55" strokeWidth="1.4" strokeDasharray="3 3" />
        {/* odlesk */}
        <path d="M30 18 L24 74" stroke="#fff" strokeOpacity=".18" strokeWidth="5" strokeLinecap="round" />
        {/* zlatý lem */}
        <rect x="5" y="86" width="90" height="12" rx="5" fill="url(#cupRim)" />
        <text x="50" y="54" textAnchor="middle" fontSize="20" fontWeight="900" fill="#fcd34d" fillOpacity=".85">
          ?
        </text>
      </svg>
    </motion.div>
  );
}

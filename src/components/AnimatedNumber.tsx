import { animate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/** Číslo, které se plynule „dopočítá“ na novou hodnotu. */
export function AnimatedNumber({ value, format }: { value: number; format?: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: 0.45,
      ease: 'easeOut',
      onUpdate: (v) => {
        prev.current = v;
        setDisplay(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value]);

  return <>{format ? format(display) : display}</>;
}

export const formatMoney = (n: number) => `${n.toLocaleString('cs-CZ')} $`;

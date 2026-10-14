// Haptická odezva přes navigator.vibrate – bezpečně ignorováno, kde není podporováno.

let enabled = true;

export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function vibrate(pattern: number | number[]): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* některé prohlížeče vibrace blokují bez interakce */
  }
}

/** Dopad kostky, položení žetonu. */
export const hapticTap = () => vibrate(20);
/** Výhra, DiceJack, Charlie. */
export const hapticWin = () => vibrate([50, 30, 100]);
/** Tropa. */
export const hapticBust = () => vibrate(250);

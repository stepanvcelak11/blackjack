// Nastavení a statistiky trenéra (localStorage, bezpečně obalené).

export interface TrainerSettings {
  /** Hodnotit každé rozhodnutí ve hře. */
  coach: boolean;
  /** Zvýraznit doporučený tah na tlačítku. */
  hints: boolean;
}

export interface TrainerStats {
  gameDecisions: number;
  gameCorrect: number;
  /** Součet ztracené EV chybami ve hře (v násobcích sázky). */
  gameEvLost: number;
  drillTotal: number;
  drillCorrect: number;
  drillStreak: number;
  drillBest: number;
  riskTotal: number;
  riskCorrect: number;
}

const SETTINGS_KEY = 'dicejack12:trainer-settings';
const STATS_KEY = 'dicejack12:trainer-stats';

export const EMPTY_STATS: TrainerStats = {
  gameDecisions: 0,
  gameCorrect: 0,
  gameEvLost: 0,
  drillTotal: 0,
  drillCorrect: 0,
  drillStreak: 0,
  drillBest: 0,
  riskTotal: 0,
  riskCorrect: 0,
};

function read<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<T>;
    const out = { ...fallback };
    for (const k of Object.keys(fallback) as (keyof T)[]) {
      if (typeof parsed[k] === typeof fallback[k]) out[k] = parsed[k] as T[keyof T];
    }
    return out;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignorovat */
  }
}

export const loadSettings = () => read<TrainerSettings>(SETTINGS_KEY, { coach: true, hints: false });
export const saveSettings = (s: TrainerSettings) => write(SETTINGS_KEY, s);
export const loadStats = () => read<TrainerStats>(STATS_KEY, EMPTY_STATS);
export const saveStats = (s: TrainerStats) => write(STATS_KEY, s);

export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

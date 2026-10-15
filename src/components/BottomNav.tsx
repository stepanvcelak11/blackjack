import { BookOpen, Dices, GraduationCap, Table2, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';

export type Screen = 'game' | 'strategy' | 'training' | 'profile' | 'rules';

const ITEMS: { id: Screen; label: string; icon: ReactNode }[] = [
  { id: 'game', label: 'Hra', icon: <Dices className="size-6" /> },
  { id: 'strategy', label: 'Strategie', icon: <Table2 className="size-6" /> },
  { id: 'training', label: 'Trénink', icon: <GraduationCap className="size-6" /> },
  { id: 'profile', label: 'Profil', icon: <UserRound className="size-6" /> },
  { id: 'rules', label: 'Pravidla', icon: <BookOpen className="size-6" /> },
];

/** Spodní lišta pro přepínání sekcí – na dosah palce. */
export function BottomNav({
  active,
  onChange,
  roundLive,
}: {
  active: Screen;
  onChange: (s: Screen) => void;
  /** Kolo běží a hráč je jinde – tečka u „Hra“. */
  roundLive: boolean;
}) {
  return (
    <nav
      aria-label="Sekce"
      className="relative z-30 grid shrink-0 grid-cols-5 border-t border-white/10 bg-slate-950 pb-[var(--nav-safe)]"
    >
      {ITEMS.map((it) => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            aria-current={on ? 'page' : undefined}
            className={`relative flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-emerald-400 ${on ? 'text-emerald-300' : 'text-slate-500 active:text-slate-300'}`}
          >
            {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-400" aria-hidden />}
            <span className="relative">
              {it.icon}
              {it.id === 'game' && roundLive && !on && (
                <span className="absolute -top-0.5 -right-1 size-2.5 animate-pulse rounded-full bg-amber-400 ring-2 ring-slate-950" />
              )}
            </span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

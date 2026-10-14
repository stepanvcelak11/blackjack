import type { ReactNode } from 'react';
import { BookOpen, Coins, Volume2, VolumeX, Wallet } from 'lucide-react';
import { AnimatedNumber, formatMoney } from './AnimatedNumber';

interface Props {
  bankroll: number;
  stake: number;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpenRules: () => void;
}

export function Header({ bankroll, stake, soundOn, onToggleSound, onOpenRules }: Props) {
  return (
    <header className="flex items-center gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Stat icon={<Wallet className="size-4" />} label="Bankroll" accent="text-emerald-300">
          <AnimatedNumber value={bankroll} format={formatMoney} />
        </Stat>
        <Stat icon={<Coins className="size-4" />} label="Sázka" accent="text-amber-300">
          <AnimatedNumber value={stake} format={formatMoney} />
        </Stat>
      </div>
      <IconButton label={soundOn ? 'Vypnout zvuk' : 'Zapnout zvuk'} onClick={onToggleSound}>
        {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5 text-slate-400" />}
      </IconButton>
      <IconButton label="Pravidla hry" onClick={onOpenRules}>
        <BookOpen className="size-5" />
      </IconButton>
    </header>
  );
}

function Stat({
  icon,
  label,
  accent,
  children,
}: {
  icon: ReactNode;
  label: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-black/30 px-2.5 py-1 ring-1 ring-white/10">
      <div className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${accent} opacity-80`}>
        {icon}
        {label}
      </div>
      <div className="truncate text-base font-black tabular-nums text-white">{children}</div>
    </div>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-xl bg-black/30 text-slate-100 ring-1 ring-white/10 transition active:scale-95 active:bg-black/50"
    >
      {children}
    </button>
  );
}

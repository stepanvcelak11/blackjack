import { motion } from 'framer-motion';
import { ChevronsUp, Dices, Hand as HandIcon, HandCoins, Plus, RotateCcw, Split, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DiceJackGame } from '../hooks/useDiceJack';
import { CHIP_VALUES } from '../lib/gameRules';
import { playButton } from '../lib/soundEffects';
import { formatMoney } from './AnimatedNumber';
import { ChipButton } from './Chip';

interface ActionProps {
  label: string;
  hint?: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
  variant: 'hit' | 'stand' | 'double' | 'split' | 'primary' | 'ghost';
  className?: string;
}

const VARIANTS: Record<ActionProps['variant'], string> = {
  hit: 'from-emerald-400 to-emerald-600 text-emerald-950 shadow-emerald-900/60',
  stand: 'from-rose-400 to-rose-600 text-white shadow-rose-900/60',
  double: 'from-amber-300 to-amber-500 text-amber-950 shadow-amber-900/60',
  split: 'from-sky-400 to-indigo-500 text-white shadow-indigo-900/60',
  primary: 'from-yellow-300 via-amber-400 to-amber-600 text-amber-950 shadow-amber-900/60',
  ghost: 'from-slate-600 to-slate-800 text-slate-100 shadow-black/60',
};

function ActionButton({ label, hint, icon, disabled, onClick, variant, className = '' }: ActionProps) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={() => {
        playButton();
        onClick();
      }}
      whileTap={disabled ? undefined : { scale: 0.94, y: 2 }}
      className={`flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b px-3 text-base font-black uppercase tracking-wide shadow-[0_4px_0_0] ring-1 ring-white/20 transition-[opacity,filter] disabled:cursor-not-allowed disabled:opacity-25 disabled:shadow-none disabled:saturate-0 ${VARIANTS[variant]} ${className}`}
    >
      {icon}
      <span className="flex flex-col items-start leading-none">
        {label}
        {hint && <span className="mt-0.5 text-[10px] font-bold normal-case tracking-normal opacity-75">{hint}</span>}
      </span>
    </motion.button>
  );
}

export function Controls({ game }: { game: DiceJackGame }) {
  const { state, actions } = game;

  if (state.phase === 'betting') {
    const funds = state.bankroll + state.bet;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-1 px-1">
          {CHIP_VALUES.map((v) => (
            <ChipButton
              key={v}
              label={String(v)}
              styleKey={String(v)}
              ariaLabel={`Vsadit ${v} $`}
              disabled={state.bankroll < v}
              onClick={() => actions.addChip(v)}
            />
          ))}
          <ChipButton
            label="ALL-IN"
            styleKey="allin"
            ariaLabel="Vsadit vše"
            disabled={state.bankroll <= 0}
            onClick={actions.allIn}
          />
        </div>
        {game.isBroke ? (
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <ActionButton
              label="Hodit"
              hint={funds > 0 ? `zbývá ${formatMoney(funds)}` : 'nic nezbylo'}
              icon={<Dices className="size-5" />}
              disabled={!game.canDeal}
              onClick={actions.deal}
              variant="ghost"
            />
            <ActionButton
              label="Půjčka od kasina"
              hint={`Reset na ${formatMoney(1000)}`}
              icon={<HandCoins className="size-6" />}
              disabled={false}
              onClick={actions.takeLoan}
              variant="primary"
            />
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_2.4fr] gap-2">
            <ActionButton
              label="Zrušit"
              icon={<Trash2 className="size-5" />}
              disabled={state.bet === 0}
              onClick={actions.clearBet}
              variant="ghost"
            />
            <ActionButton
              label="Hodit kostky"
              hint={state.bet > 0 ? `Sázka ${formatMoney(state.bet)}` : 'Nejdřív vsaďte žetony'}
              icon={<Dices className="size-6" />}
              disabled={!game.canDeal}
              onClick={actions.deal}
              variant="primary"
            />
          </div>
        )}
      </div>
    );
  }

  if (state.phase === 'settled') {
    const canRebet = state.lastBet > 0 && state.lastBet <= state.bankroll;
    return (
      <div className="flex flex-col gap-2">
        {game.isBroke ? (
          <ActionButton
            label="Půjčka od kasina"
            hint={`Došly peníze – reset na ${formatMoney(1000)}`}
            icon={<HandCoins className="size-6" />}
            disabled={false}
            onClick={actions.takeLoan}
            variant="primary"
            className="h-[7.5rem] text-lg"
          />
        ) : (
          <ActionButton
            label="Další kolo"
            hint={canRebet ? `Stejná sázka ${formatMoney(state.lastBet)} (lze upravit)` : 'Vsaďte znovu'}
            icon={<RotateCcw className="size-6" />}
            disabled={false}
            onClick={actions.nextRound}
            variant="primary"
            className="h-[7.5rem] text-lg"
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <ActionButton
        label="Přihodit"
        hint="+1 kostka"
        icon={<Plus className="size-6" strokeWidth={3} />}
        disabled={!game.canHit}
        onClick={actions.hit}
        variant="hit"
      />
      <ActionButton
        label="Stát"
        hint="ukončit tah"
        icon={<HandIcon className="size-6" />}
        disabled={!game.canStand}
        onClick={actions.stand}
        variant="stand"
      />
      <ActionButton
        label="Double"
        hint="2× sázka, 1 kostka"
        icon={<ChevronsUp className="size-6" strokeWidth={3} />}
        disabled={!game.canDouble}
        onClick={actions.doubleDown}
        variant="double"
      />
      <ActionButton
        label="Rozdělit"
        hint="split páru"
        icon={<Split className="size-6" />}
        disabled={!game.canSplit}
        onClick={actions.split}
        variant="split"
      />
    </div>
  );
}

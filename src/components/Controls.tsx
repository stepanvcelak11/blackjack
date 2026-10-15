import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsUp, Crosshair, Dices, Hand as HandIcon, HandCoins, Plus, RotateCcw, Split, Trash2 } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import type { DiceJackGame } from '../hooks/useDiceJack';
import { CHIP_VALUES, STARTING_BANKROLL } from '../lib/gameRules';
import { playButton } from '../lib/soundEffects';
import type { Move } from '../lib/strategy';
import { formatMoney } from './AnimatedNumber';
import { ChipButton } from './Chip';

/** „Podrž a zatřes“: start při stisku, akce při puštění. */
export interface HoldHandlers {
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

interface ActionProps {
  label: string;
  hint?: string;
  icon: ReactNode;
  disabled: boolean;
  onClick: () => void;
  variant: 'hit' | 'stand' | 'double' | 'split' | 'primary' | 'ghost' | 'safe';
  className?: string;
  hold?: HoldHandlers;
  /** Nápověda trenéra: tohle je doporučený tah. */
  recommended?: boolean;
}

const VARIANTS: Record<ActionProps['variant'], string> = {
  hit: 'from-emerald-400 to-emerald-600 text-emerald-950 shadow-emerald-900/60',
  stand: 'from-rose-400 to-rose-600 text-white shadow-rose-900/60',
  double: 'from-amber-300 to-amber-500 text-amber-950 shadow-amber-900/60',
  split: 'from-sky-400 to-indigo-500 text-white shadow-indigo-900/60',
  primary: 'from-yellow-300 via-amber-400 to-amber-600 text-amber-950 shadow-amber-900/60',
  ghost: 'from-slate-600 to-slate-800 text-slate-100 shadow-black/60',
  safe: 'from-yellow-200 via-amber-400 to-yellow-700 text-amber-950 shadow-yellow-900/70 ring-2 ring-yellow-200/80',
};

function ActionButton({ label, hint, icon, disabled, onClick, variant, className = '', hold, recommended = false }: ActionProps) {
  const holding = useRef(false);

  const fire = () => {
    playButton();
    onClick();
  };
  const endHold = (commit: boolean) => {
    if (!holding.current) return;
    holding.current = false;
    hold?.onHoldEnd();
    if (commit) fire();
  };

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (!hold || disabled || e.button > 0) return;
        holding.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        hold.onHoldStart();
      }}
      onPointerUp={() => endHold(true)}
      onPointerCancel={() => endHold(false)}
      onContextMenu={(e) => hold && e.preventDefault()}
      onClick={(e) => {
        // U „hold“ tlačítek akci spouští puštění prstu; klik z klávesnice (detail 0) funguje dál.
        if (hold && e.detail !== 0) return;
        fire();
      }}
      whileTap={disabled ? undefined : { scale: 0.94, y: 2 }}
      className={`no-callout relative flex h-14 touch-none items-center justify-center gap-2 rounded-2xl bg-gradient-to-b px-3 text-base font-black tracking-wide uppercase shadow-[0_4px_0_0] ring-1 ring-white/20 transition-[opacity,filter] disabled:cursor-not-allowed disabled:opacity-25 disabled:shadow-none disabled:saturate-0 ${VARIANTS[variant]} ${recommended ? 'recommended' : ''} ${className}`}
    >
      {recommended && (
        <span className="absolute -top-2 right-2 rounded-full bg-white px-1.5 text-[9px] leading-4 font-black tracking-wider text-emerald-700 shadow">
          DOPORUČENO
        </span>
      )}
      {icon}
      <span className="flex flex-col items-start leading-none">
        {label}
        {hint && <span className="mt-0.5 text-[10px] font-bold tracking-normal normal-case opacity-75">{hint}</span>}
      </span>
    </motion.button>
  );
}

export interface GameActions {
  hit: () => void;
  stand: () => void;
  doubleDown: () => void;
  split: () => void;
  safeHit: () => void;
}

export function Controls({
  game,
  hold,
  play,
  recommended,
}: {
  game: DiceJackGame;
  hold: HoldHandlers;
  /** Tahy hráče (obalené trenérem). */
  play: GameActions;
  recommended?: Move | null;
}) {
  const { state, actions } = game;

  if (state.phase === 'betting') {
    const funds = state.bankroll + state.bet + state.sideBet;
    const onSide = state.betTarget === 'side';
    return (
      <div className="flex flex-col gap-2.5">
        <div className="text-center text-[10px] font-bold tracking-widest uppercase text-slate-400">
          Žetony na:{' '}
          <span className={onSide ? 'text-fuchsia-300' : 'text-amber-300'}>
            {onSide ? 'Sázka na pár (4:1)' : 'Hlavní sázka'}
          </span>
        </div>
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
              hold={hold}
            />
            <ActionButton
              label="Půjčka od kasina"
              hint={`Reset na ${formatMoney(STARTING_BANKROLL)}`}
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
              disabled={state.bet + state.sideBet === 0}
              onClick={actions.clearBet}
              variant="ghost"
            />
            <ActionButton
              label="Hodit kostky"
              hint={state.bet > 0 ? 'Klepni, nebo podrž a zatřes' : 'Nejdřív vsaďte žetony'}
              icon={<Dices className="size-6" />}
              disabled={!game.canDeal}
              onClick={actions.deal}
              variant="primary"
              hold={hold}
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
            hint={`Došly peníze – reset na ${formatMoney(STARTING_BANKROLL)}`}
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
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {game.offerSafeHit && (
          <motion.div
            key="safe"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="-mx-1 -mt-2 overflow-hidden px-1 pt-2 pb-1"
          >
            <ActionButton
              label="Bezpečný příhoz (d3)"
              hint={
                game.canSafeHit
                  ? `Cinknutá kostka 1–3 · cena ${formatMoney(game.safeHitCost)} · 1× za kolo`
                  : `Nedostatek žetonů (${formatMoney(game.safeHitCost)})`
              }
              icon={<Crosshair className="size-6" />}
              disabled={!game.canSafeHit}
              onClick={play.safeHit}
              recommended={recommended === 'B'}
              variant="safe"
              className="h-12 w-full"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          label="Přihodit"
          hint="klepni / podrž"
          icon={<Plus className="size-6" strokeWidth={3} />}
          disabled={!game.canHit}
          onClick={play.hit}
          recommended={recommended === 'H'}
          variant="hit"
          hold={hold}
        />
        <ActionButton
          label="Stát"
          hint="ukončit tah"
          icon={<HandIcon className="size-6" />}
          disabled={!game.canStand}
          onClick={play.stand}
          recommended={recommended === 'S'}
          variant="stand"
        />
        <ActionButton
          label="Double"
          hint="2× sázka, 1 kostka"
          icon={<ChevronsUp className="size-6" strokeWidth={3} />}
          disabled={!game.canDouble}
          onClick={play.doubleDown}
          recommended={recommended === 'D'}
          variant="double"
        />
        <ActionButton
          label="Rozdělit"
          hint="split páru"
          icon={<Split className="size-6" />}
          disabled={!game.canSplit}
          onClick={play.split}
          recommended={recommended === 'P'}
          variant="split"
        />
      </div>
    </div>
  );
}

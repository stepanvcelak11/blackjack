import { useState } from 'react';
import type { GameState } from '../../hooks/useDiceJack';
import { pct, type TrainerSettings, type TrainerStats } from '../../lib/trainerStore';
import { formatMoney } from '../AnimatedNumber';
import { Toggle } from '../trainer/ui';
import { ScreenShell } from './ScreenShell';

interface Props {
  game: Pick<GameState, 'bankroll' | 'highScore' | 'rounds' | 'streak' | 'loans'>;
  stats: TrainerStats;
  settings: TrainerSettings;
  onSettings: (s: TrainerSettings) => void;
  soundOn: boolean;
  onSound: (v: boolean) => void;
  onResetStats: () => void;
  canResetBankroll: boolean;
  onResetBankroll: () => void;
}

export function ProfileScreen(p: Props) {
  const { game, stats } = p;
  const accuracy = pct(stats.gameCorrect, stats.gameDecisions);
  return (
    <ScreenShell title="Profil" subtitle="Statistiky a nastavení">
      <div className="flex flex-col gap-5">
        <section aria-labelledby="game-stats">
          <h2 id="game-stats" className="mb-2 text-xs font-bold tracking-wider text-emerald-400 uppercase">
            Hra
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Bankroll" value={formatMoney(game.bankroll)} />
            <Tile label="Rekord" value={formatMoney(game.highScore)} />
            <Tile label="Odehraná kola" value={String(game.rounds)} />
            <Tile label="Vítězná série" value={String(game.streak)} />
          </div>
        </section>

        <section aria-labelledby="coach-stats">
          <h2 id="coach-stats" className="mb-2 text-xs font-bold tracking-wider text-emerald-400 uppercase">
            Přesnost strategie
          </h2>
          <div className="rounded-xl bg-slate-900 p-3 ring-1 ring-white/5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-400">Rozhodnutí ve hře</span>
              <span className="text-2xl font-black text-white tabular-nums">{accuracy} %</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden>
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${accuracy}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {stats.gameCorrect} z {stats.gameDecisions} tahů optimálně · chybami ztraceno{' '}
              {(stats.gameEvLost * 100).toFixed(0)} % sázky
            </p>
          </div>
          <dl className="mt-2 divide-y divide-white/5 rounded-xl bg-slate-900 ring-1 ring-white/5">
            <Row
              k="Dril rozhodování"
              v={`${pct(stats.drillCorrect, stats.drillTotal)} % (${stats.drillCorrect}/${stats.drillTotal})`}
            />
            <Row k="Nejdelší série v drilu" v={String(stats.drillBest)} />
            <Row
              k="Odhad rizika"
              v={`${pct(stats.riskCorrect, stats.riskTotal)} % (${stats.riskCorrect}/${stats.riskTotal})`}
            />
          </dl>
        </section>

        <section aria-labelledby="settings" className="flex flex-col gap-2">
          <h2 id="settings" className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
            Nastavení
          </h2>
          <Toggle
            id="coach-toggle"
            label="Trenér ve hře"
            hint="Po každém tahu ukáže, jestli byl optimální."
            checked={p.settings.coach}
            onChange={(v) => p.onSettings({ ...p.settings, coach: v })}
          />
          <Toggle
            id="hints-toggle"
            label="Nápověda"
            hint="Zvýrazní doporučený tah na tlačítku."
            checked={p.settings.hints}
            onChange={(v) => p.onSettings({ ...p.settings, hints: v })}
          />
          <Toggle
            id="sound-toggle"
            label="Zvuky"
            hint="Kostky, žetony, výhry."
            checked={p.soundOn}
            onChange={p.onSound}
          />
        </section>

        <section className="flex flex-col gap-2">
          <Confirm label="Vynulovat statistiky tréninku" confirmLabel="Ano, vynulovat" onConfirm={p.onResetStats} />
          <Confirm
            label={`Začít znovu s ${formatMoney(1000)}`}
            confirmLabel="Ano, začít znovu"
            onConfirm={p.onResetBankroll}
            disabled={!p.canResetBankroll}
            hint={p.canResetBankroll ? undefined : 'Nejdřív dohrajte rozehrané kolo.'}
          />
        </section>
      </div>
    </ScreenShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 ring-1 ring-white/5">
      <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{label}</div>
      <div className="truncate text-lg font-black text-white tabular-nums">{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 px-3 py-2 text-sm">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-bold tabular-nums">{v}</dd>
    </div>
  );
}

function Confirm({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  hint,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  const [ask, setAsk] = useState(false);
  if (ask)
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onConfirm();
            setAsk(false);
          }}
          className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setAsk(false)}
          className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-bold"
        >
          Zpět
        </button>
      </div>
    );
  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setAsk(true)}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-rose-300 ring-1 ring-white/10 disabled:opacity-40"
      >
        {label}
      </button>
      {hint && <p className="mt-1 text-center text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

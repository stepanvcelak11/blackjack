import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { score, type DieValue } from '../../lib/gameRules';
import {
  advise,
  chart,
  chartPosition,
  dealerDistribution,
  UPCARDS,
  type ChartCell,
  type ChartKind,
  type ChartRow,
} from '../../lib/strategy';
import { DieFace } from '../Die';
import { CELL_STYLE, EvTable } from '../trainer/ui';
import { ScreenShell, Segmented } from './ScreenShell';

type Kind = ChartKind | 'dealer';

const KINDS = [
  ['hard', 'Tvrdé'],
  ['soft', 'Měkké'],
  ['pairs', 'Páry'],
  ['three', '3 kostky'],
  ['dealer', 'Krupiér'],
] as const;

const KIND_INFO: Record<Kind, string> = {
  hard: 'Dvě kostky bez jedničky. Řádek = váš součet, sloupec = viditelná kostka krupiéra.',
  soft: 'Jednička + další kostka. Jednička platí 1 nebo 4, proto dvě hodnoty.',
  pairs: 'Dvě stejné kostky – smí se rozdělit (6-6 je DiceJack).',
  three: 'Tři kostky bez jedničky: další přežitý hod znamená 4-Kostkového Charlieho (2:1).',
  dealer: 'Jak krupiér skončí podle kostky, kterou ukazuje. Počítá se s pravidlem „táhne do 8 a na měkkou 9“.',
};

const CELL_MEANING: Record<ChartCell, string> = {
  H: 'Přihodit',
  S: 'Stát',
  D: 'Double, když nejde, přihodit',
  Ds: 'Double, když nejde, stát',
  P: 'Rozdělit',
  Ph: 'Rozdělit, když nejde, přihodit',
  Ps: 'Rozdělit, když nejde, stát',
  B: 'Bezpečný příhoz d3, když nejde, přihodit',
  Bs: 'Bezpečný příhoz d3, když nejde, stát',
};

export interface CurrentHand {
  dice: number[];
  up: number;
}

export function StrategyScreen({ current }: { current: CurrentHand | null }) {
  const pos = current ? chartPosition(current.dice) : null;
  const [kind, setKind] = useState<Kind>(pos?.kind ?? 'hard');
  const [picked, setPicked] = useState<{ row: ChartRow; up: number } | null>(null);

  return (
    <ScreenShell
      title="Strategie"
      subtitle="Základní strategie spočítaná přesně pro DiceJack 12"
      toolbar={
        <Segmented
          value={kind}
          options={KINDS}
          onChange={(k) => {
            setKind(k);
            setPicked(null);
          }}
          label="Kategorie tabulky"
        />
      }
    >
      <p className="mb-3 text-xs leading-relaxed text-slate-400">{KIND_INFO[kind]}</p>
      {current && pos && pos.kind === kind && (
        <p className="mb-3 rounded-lg bg-emerald-950/70 px-3 py-2 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/30">
          Rozehraná ruka je v tabulce orámovaná bíle.
        </p>
      )}
      {kind === 'dealer' ? (
        <DealerChart />
      ) : (
        <>
          <StrategyTable
            kind={kind}
            highlight={pos && pos.kind === kind && current ? { label: pos.label, up: current.up } : null}
            picked={picked}
            onPick={(row, up) => setPicked(picked?.row === row && picked.up === up ? null : { row, up })}
          />
          <AnimatePresence>
            {picked && (
              <CellDetail
                key={`${picked.row.label}-${picked.up}`}
                kind={kind}
                {...picked}
                onClose={() => setPicked(null)}
              />
            )}
          </AnimatePresence>
          <Legend />
        </>
      )}
    </ScreenShell>
  );
}

function StrategyTable({
  kind,
  highlight,
  picked,
  onPick,
}: {
  kind: ChartKind;
  highlight: { label: string; up: number } | null;
  picked: { row: ChartRow; up: number } | null;
  onPick: (row: ChartRow, up: number) => void;
}) {
  const rows = chart(kind);
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-white/10">
      <table className="w-full border-collapse text-center text-sm">
        <caption className="sr-only">Strategická tabulka – {kind}</caption>
        <thead className="bg-slate-900">
          <tr>
            <th
              scope="col"
              className="px-2 py-1.5 text-left text-[10px] leading-tight font-bold text-slate-400 uppercase"
            >
              Vy
              <br />
              <span className="text-slate-500">krupiér →</span>
            </th>
            {UPCARDS.map((u) => (
              <th key={u} scope="col" className="py-1.5" aria-label={`Krupiér ukazuje ${u}`}>
                <div className="flex justify-center">
                  <DieFace value={u as DieValue} size={24} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="bg-slate-900 px-2 py-0 text-left whitespace-nowrap">
                <span className="text-base font-black text-white">{r.label}</span>
                {r.sub && <span className="ml-1 text-[10px] font-semibold text-slate-400">{r.sub}</span>}
              </th>
              {r.cells.map((c, i) => {
                const up = UPCARDS[i];
                const isCurrent = highlight?.label === r.label && highlight.up === up;
                const isPicked = picked?.row.label === r.label && picked.up === up;
                return (
                  <td key={i} className="p-0">
                    <button
                      type="button"
                      onClick={() => onPick(r, up)}
                      aria-label={`${r.label} proti ${up}: ${CELL_MEANING[c]}`}
                      className={`relative block h-11 w-full border border-slate-950 text-sm font-black transition focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-emerald-300 ${CELL_STYLE[c]} ${isPicked ? 'z-10 scale-110 shadow-lg ring-2 ring-slate-950' : ''} ${isCurrent ? 'z-10 ring-4 ring-white ring-inset' : ''}`}
                    >
                      {c}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CellDetail({ kind, row, up, onClose }: { kind: ChartKind; row: ChartRow; up: number; onClose: () => void }) {
  const advice = useMemo(() => {
    const sc = score(row.dice.map((v) => ({ value: v as DieValue })));
    return advise({
      dice: row.dice,
      up,
      canDouble: row.dice.length === 2,
      canSplit: kind === 'pairs',
      canSafe: [8, 9, 10].includes(sc.best),
    });
  }, [row, up, kind]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="mt-3 rounded-xl bg-slate-900 p-3 ring-1 ring-white/10"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex gap-1">
          {row.dice.map((v, i) => (
            <DieFace key={i} value={v as DieValue} size={26} />
          ))}
        </div>
        <span className="text-xs font-bold text-slate-400">proti</span>
        <DieFace value={up as DieValue} size={26} />
        <button
          type="button"
          onClick={onClose}
          className="ml-auto grid size-8 place-items-center rounded-full bg-white/10"
          aria-label="Zavřít detail"
        >
          <X className="size-4" />
        </button>
      </div>
      <EvTable advice={advice} />
      <p className="mt-2 text-[11px] text-slate-500">EV = průměrný zisk v % sázky při optimální další hře.</p>
    </motion.div>
  );
}

function Legend() {
  return (
    <ul className="mt-4 grid grid-cols-1 gap-1.5 text-xs text-slate-300 min-[380px]:grid-cols-2">
      {(Object.keys(CELL_MEANING) as ChartCell[]).map((c) => (
        <li key={c} className="flex items-center gap-2">
          <b className={`inline-block w-7 shrink-0 rounded py-0.5 text-center text-[11px] ${CELL_STYLE[c]}`}>{c}</b>
          {CELL_MEANING[c]}
        </li>
      ))}
    </ul>
  );
}

// ---------- Graf krupiéra ----------

const OUTCOMES = [
  { key: 9, label: '9', color: '#6ee7b7' },
  { key: 10, label: '10', color: '#34d399' },
  { key: 11, label: '11', color: '#10b981' },
  { key: 12, label: '12', color: '#047857' },
  { key: 13, label: 'Tropa', color: '#fbbf24' },
] as const;

function DealerChart() {
  const [active, setActive] = useState<number | null>(null);
  const data = UPCARDS.map((u) => ({ up: u, dist: dealerDistribution(u) }));
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-300" aria-label="Legenda">
        {OUTCOMES.map((o) => (
          <li key={o.key} className="flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm" style={{ background: o.color }} />
            {o.key === 13 ? 'Tropa krupiéra' : `Stojí na ${o.label}`}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2" role="list">
        {data.map(({ up, dist }) => {
          const bust = dist[13];
          const isActive = active === up;
          return (
            <button
              key={up}
              type="button"
              role="listitem"
              onClick={() => setActive(isActive ? null : up)}
              aria-expanded={isActive}
              aria-label={`Krupiér ukazuje ${up}: tropa ${(bust * 100).toFixed(0)} %`}
              className={`flex items-center gap-2 rounded-lg p-1 text-left transition-colors ${isActive ? 'bg-slate-800' : 'active:bg-slate-900'}`}
            >
              <DieFace value={up as DieValue} size={28} />
              <div className="flex h-7 min-w-0 flex-1 gap-[2px] overflow-hidden rounded-[4px]">
                {OUTCOMES.map((o) => {
                  const p = dist[o.key];
                  return (
                    <div
                      key={o.key}
                      className="grid h-full place-items-center text-[10px] font-bold text-slate-950"
                      style={{ width: `${p * 100}%`, background: o.color }}
                    >
                      {p >= 0.12 ? `${Math.round(p * 100)}` : ''}
                    </div>
                  );
                })}
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-black text-amber-300 tabular-nums">
                {(bust * 100).toFixed(0)} %
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">
        Čísla v pruzích jsou procenta. Vpravo je šance, že krupiér přetáhne. Klepnutím na řádek zobrazíte přesná čísla.
      </p>
      <AnimatePresence>
        {active !== null && (
          <motion.table
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full rounded-xl bg-slate-900 text-sm ring-1 ring-white/10"
          >
            <caption className="px-3 pt-2 text-left text-xs font-bold text-slate-400">
              Krupiér ukazuje {active}
              {active === 6 && ' (6-6 vyloučeno nahlédnutím)'}
            </caption>
            <tbody>
              {OUTCOMES.map((o) => (
                <tr key={o.key}>
                  <td className="px-3 py-1">
                    <span className="mr-2 inline-block size-2.5 rounded-sm" style={{ background: o.color }} />
                    {o.key === 13 ? 'Tropa' : `Konečný součet ${o.label}`}
                  </td>
                  <td className="px-3 py-1 text-right font-bold tabular-nums">
                    {(dealerDistribution(active)[o.key] * 100).toFixed(1)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </motion.table>
        )}
      </AnimatePresence>
    </div>
  );
}

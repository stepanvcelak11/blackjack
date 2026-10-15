import { score, type DieValue } from '../../lib/gameRules';
import { MOVE_LABEL, type Advice, type ChartCell, type Move, type Situation } from '../../lib/strategy';
import { DieFace } from '../Die';

// Barvy jako v klasických tabulkách BJ Wiz: S žlutá, H bílá, D zelená, P modrá; d3 kov/oranž.
export const MOVE_STYLE: Record<Move, string> = {
  H: 'bg-white text-slate-900',
  S: 'bg-yellow-400 text-slate-950',
  D: 'bg-emerald-500 text-slate-950',
  P: 'bg-sky-400 text-slate-950',
  B: 'bg-orange-400 text-slate-950',
};

export const CELL_STYLE: Record<ChartCell, string> = {
  H: MOVE_STYLE.H,
  S: MOVE_STYLE.S,
  D: MOVE_STYLE.D,
  Ds: 'bg-emerald-300 text-slate-950',
  P: MOVE_STYLE.P,
  Ph: MOVE_STYLE.P,
  Ps: 'bg-sky-300 text-slate-950',
  B: MOVE_STYLE.B,
  Bs: 'bg-orange-300 text-slate-950',
};

export const fmtEv = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)} %`;

export function SituationView({ sit }: { sit: Situation }) {
  const sc = score(sit.dice.map((v) => ({ value: v as DieValue })));
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-b from-emerald-900/70 to-emerald-950/70 px-3 py-4 ring-1 ring-emerald-400/20">
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-bold tracking-widest text-emerald-200/70 uppercase">Krupiér ukazuje</span>
        <DieFace value={sit.up as DieValue} size={44} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1.5">
          {sit.dice.map((v, i) => (
            <DieFace key={i} value={v as DieValue} size={50} />
          ))}
        </div>
        <span className="text-sm font-black text-white tabular-nums">
          {sc.soft ? `${sc.hard} / ${sc.best} (měkká)` : `Součet ${sc.best}`}
          <span className="ml-2 text-xs font-semibold text-emerald-200/70">{sit.dice.length} kostky</span>
        </span>
      </div>
    </div>
  );
}

export function EvTable({ advice, chosen }: { advice: Advice; chosen?: Move }) {
  const rows = (Object.entries(advice.evs) as [Move, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([m, ev]) => (
          <tr key={m} className={m === advice.best ? 'font-black' : ''}>
            <td className="py-0.5">
              <span className={`mr-2 inline-block w-6 rounded text-center text-xs font-black ${MOVE_STYLE[m]}`}>
                {m}
              </span>
              {MOVE_LABEL[m]}
              {m === chosen && m !== advice.best && <span className="ml-1 text-xs text-rose-400">(vaše volba)</span>}
            </td>
            <td className={`text-right tabular-nums ${ev >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtEv(ev)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 rounded-xl bg-slate-900 p-3 ring-1 ring-white/5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[11px] text-slate-400">{hint}</div>
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span
          className={`absolute top-1 size-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`}
        />
      </span>
    </label>
  );
}

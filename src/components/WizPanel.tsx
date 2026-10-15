import { AnimatePresence, motion } from 'framer-motion';
import { Check, GraduationCap, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHARLIE_DICE, score, type DieValue } from '../lib/gameRules';
import { hapticBust, hapticTap } from '../lib/haptics';
import { playBust, playChip } from '../lib/soundEffects';
import {
  advise,
  bustPercent,
  chart,
  MOVE_LABEL,
  UPCARDS,
  type Advice,
  type ChartCell,
  type ChartKind,
  type Move,
  type Situation,
} from '../lib/strategy';
import { pct, type TrainerSettings, type TrainerStats } from '../lib/trainerStore';
import { DieFace } from './Die';

// Barvy jako v klasických tabulkách BJ Wiz: S žlutá, H bílá, D zelená, P modrá; d3 kov/oranž.
export const MOVE_STYLE: Record<Move, string> = {
  H: 'bg-white text-slate-900',
  S: 'bg-yellow-400 text-slate-950',
  D: 'bg-emerald-500 text-slate-950',
  P: 'bg-sky-400 text-slate-950',
  B: 'bg-orange-400 text-slate-950',
};

const CELL_STYLE: Record<ChartCell, string> = {
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

const fmtEv = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)} %`;

type Tab = 'drill' | 'chart' | 'risk' | 'coach';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: TrainerSettings;
  onSettings: (s: TrainerSettings) => void;
  stats: TrainerStats;
  onStats: (fn: (s: TrainerStats) => TrainerStats) => void;
  onResetStats: () => void;
}

export function WizPanel({ open, onClose, settings, onSettings, stats, onStats, onResetStats }: Props) {
  const [tab, setTab] = useState<Tab>('drill');
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-40 flex flex-col bg-slate-950 text-slate-100"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="wiz-title"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.5rem))] pb-3">
            <GraduationCap className="size-6 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <h2 id="wiz-title" className="text-base font-black tracking-wide text-emerald-400">
                DiceJack Wiz
              </h2>
              <p className="text-[11px] font-semibold text-slate-400">Trénink optimální strategie</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-10 place-items-center rounded-full bg-white/10 active:bg-white/20"
              aria-label="Zavřít trenažér"
            >
              <X className="size-5" />
            </button>
          </div>

          <nav className="flex gap-1 px-3 pt-3" aria-label="Sekce trenažéru">
            {(
              [
                ['drill', 'Dril'],
                ['chart', 'Tabulky'],
                ['risk', 'Riziko'],
                ['coach', 'Trenér'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
                className={`flex-1 rounded-lg py-2 text-xs font-bold tracking-wide uppercase transition-colors ${tab === id ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 active:bg-slate-900'}`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {tab === 'drill' && <Drill stats={stats} onStats={onStats} />}
            {tab === 'chart' && <Charts />}
            {tab === 'risk' && <RiskDrill stats={stats} onStats={onStats} />}
            {tab === 'coach' && (
              <Coach settings={settings} onSettings={onSettings} stats={stats} onReset={onResetStats} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Dril rozhodování ----------

const rnd = (n: number) => Math.floor(Math.random() * n) + 1;

function randomSituation(): Situation {
  for (;;) {
    const up = rnd(6);
    const three = Math.random() < 0.3;
    const dice = three ? [rnd(6), rnd(6), rnd(6)] : [rnd(6), rnd(6)];
    const sc = score(dice.map((v) => ({ value: v as DieValue })));
    if (sc.hard > 12 || sc.best === 12) continue;
    if (dice.length >= CHARLIE_DICE) continue;
    const two = dice.length === 2;
    return {
      dice,
      up,
      canDouble: two,
      canSplit: two && dice[0] === dice[1],
      canSafe: [8, 9, 10].includes(sc.best),
    };
  }
}

function SituationView({ sit }: { sit: Situation }) {
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

function EvTable({ advice, chosen }: { advice: Advice; chosen?: Move }) {
  const rows = (Object.entries(advice.evs) as [Move, number][]).sort((a, b) => b[1] - a[1]);
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([m, ev]) => (
          <tr key={m} className={m === advice.best ? 'font-black' : ''}>
            <td className="py-0.5">
              <span className={`mr-2 inline-block w-6 rounded text-center text-xs font-black ${MOVE_STYLE[m]}`}>{m}</span>
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

function Drill({ stats, onStats }: { stats: TrainerStats; onStats: Props['onStats'] }) {
  const [sit, setSit] = useState<Situation>(randomSituation);
  const [answer, setAnswer] = useState<Move | null>(null);
  const advice = useMemo(() => advise(sit), [sit]);

  const next = useCallback(() => {
    setSit(randomSituation());
    setAnswer(null);
  }, []);

  // Po správné odpovědi automaticky další situace (jako ve Wiz).
  useEffect(() => {
    if (answer && answer === advice.best) {
      const t = setTimeout(next, 1100);
      return () => clearTimeout(t);
    }
  }, [answer, advice.best, next]);

  const submit = (m: Move) => {
    if (answer) return;
    const ok = m === advice.best;
    setAnswer(m);
    if (ok) {
      playChip();
      hapticTap();
    } else {
      playBust();
      hapticBust();
    }
    onStats((s) => {
      const streak = ok ? s.drillStreak + 1 : 0;
      return {
        ...s,
        drillTotal: s.drillTotal + 1,
        drillCorrect: s.drillCorrect + (ok ? 1 : 0),
        drillStreak: streak,
        drillBest: Math.max(s.drillBest, streak),
      };
    });
  };

  const moves: Move[] = ['H', 'S'];
  if (sit.canDouble) moves.push('D');
  if (sit.canSplit) moves.push('P');
  if (sit.canSafe) moves.push('B');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-xs font-bold text-slate-400">
        <span>
          Úspěšnost <span className="text-emerald-400">{pct(stats.drillCorrect, stats.drillTotal)} %</span> (
          {stats.drillCorrect}/{stats.drillTotal})
        </span>
        <span>
          Série <span className="text-amber-300">{stats.drillStreak}</span> · rekord {stats.drillBest}
        </span>
      </div>
      <SituationView sit={sit} />
      <div className="grid grid-cols-2 gap-2">
        {moves.map((m) => {
          const isBest = answer && m === advice.best;
          const isWrong = answer === m && m !== advice.best;
          return (
            <button
              key={m}
              type="button"
              onClick={() => submit(m)}
              disabled={!!answer}
              className={`rounded-xl py-3 text-sm font-extrabold uppercase shadow transition ${MOVE_STYLE[m]} ${m === 'B' && moves.length % 2 === 1 ? 'col-span-2' : ''} ${answer && !isBest && !isWrong ? 'opacity-30' : ''} ${isBest ? 'ring-4 ring-emerald-300' : ''} ${isWrong ? 'ring-4 ring-rose-500' : ''}`}
            >
              {MOVE_LABEL[m]} ({m})
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        {answer && (
          <motion.div
            key={`${sit.dice.join()}-${sit.up}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded-xl p-3 ring-1 ${answer === advice.best ? 'bg-emerald-950 ring-emerald-500/50' : 'bg-rose-950/70 ring-rose-500/50'}`}
          >
            <div className="mb-2 flex items-center gap-2 font-black">
              {answer === advice.best ? (
                <>
                  <Check className="size-5 text-emerald-400" /> Správně!
                </>
              ) : (
                <>
                  <X className="size-5 text-rose-400" /> Chyba – správně je {MOVE_LABEL[advice.best]}
                </>
              )}
            </div>
            <EvTable advice={advice} chosen={answer} />
            <p className="mt-2 text-[11px] text-slate-400">EV = průměrný zisk v % sázky při optimální další hře.</p>
            {answer !== advice.best && (
              <button
                type="button"
                onClick={next}
                className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 font-extrabold text-slate-950 active:bg-emerald-600"
              >
                Další situace
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Strategické tabulky ----------

const CHART_TABS: [ChartKind, string, string][] = [
  ['hard', 'Tvrdé', 'Dvě kostky bez jedničky'],
  ['soft', 'Měkké', 'Jednička + kostka (1 = 1 nebo 4)'],
  ['pairs', 'Páry', 'Dvě stejné kostky (6-6 je DiceJack)'],
  ['three', '3 kostky', 'Tři kostky bez jedničky – jeden hod od Charlieho'],
];

function Charts() {
  const [kind, setKind] = useState<ChartKind>('hard');
  const rows = chart(kind);
  const desc = CHART_TABS.find((t) => t[0] === kind)?.[2];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-slate-900 p-1">
        {CHART_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            aria-pressed={kind === id}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${kind === id ? 'bg-slate-700 text-emerald-400' : 'text-slate-400'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">{desc}</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-xs">
          <thead>
            <tr>
              <th className="p-1 text-left text-[10px] font-bold text-slate-400 uppercase">Vy \ Krupiér</th>
              {UPCARDS.map((u) => (
                <th key={u} className="p-1">
                  <div className="flex justify-center">
                    <DieFace value={u as DieValue} size={22} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th className="p-1 text-left font-black whitespace-nowrap text-slate-200">
                  {r.label}
                  {r.sub && <span className="ml-1 text-[10px] font-semibold text-slate-500">{r.sub}</span>}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className={`border border-slate-950 p-1.5 font-bold ${CELL_STYLE[c]}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300">
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.H}`}>H</b> Přihodit</li>
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.S}`}>S</b> Stát</li>
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.D}`}>D</b> Double, jinak přihodit</li>
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.Ds}`}>Ds</b> Double, jinak stát</li>
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.P}`}>Ph</b> Rozdělit, jinak přihodit</li>
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.Ps}`}>Ps</b> Rozdělit, jinak stát</li>
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.B}`}>B</b> d3, jinak přihodit</li>
        <li><b className={`mr-1 rounded px-1 ${CELL_STYLE.Bs}`}>Bs</b> d3, jinak stát</li>
      </ul>
      <p className="text-[11px] leading-relaxed text-slate-500">
        Tabulky jsou spočítané přesně (dynamické programování nad všemi hody) pro pravidla této hry: krupiér táhne do 8
        a na měkkou 9, nahlíží při šestce, Charlie 4 kostky 2:1, d3 za 50 % sázky.
      </p>
    </div>
  );
}

// ---------- Trénink rizika (náhrada za počítání karet) ----------

const RISK_OPTIONS = [0, 17, 33, 50, 67, 83];

function randomRiskHand(): number[] {
  for (;;) {
    const n = 2 + Math.floor(Math.random() * 2);
    const dice = Array.from({ length: n }, () => rnd(6));
    const hard = dice.reduce((a, b) => a + b, 0);
    if (hard >= 5 && hard <= 12) return dice;
  }
}

function RiskDrill({ stats, onStats }: { stats: TrainerStats; onStats: Props['onStats'] }) {
  const [dice, setDice] = useState<number[]>(randomRiskHand);
  const [answer, setAnswer] = useState<number | null>(null);
  const hard = dice.reduce((a, b) => a + b, 0);
  const correct = bustPercent(hard);
  const safeMax = Math.max(0, Math.min(6, 12 - hard));

  const submit = (v: number) => {
    if (answer !== null) return;
    setAnswer(v);
    const ok = v === correct;
    if (ok) playChip();
    else playBust();
    onStats((s) => ({ ...s, riskTotal: s.riskTotal + 1, riskCorrect: s.riskCorrect + (ok ? 1 : 0) }));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-slate-400">
        Kostky nemají paměť, takže počítání jako Hi-Lo u karet tu nefunguje. Místo toho trénujte okamžitý odhad
        rizika tropy.
      </p>
      <div className="text-xs font-bold text-slate-400">
        Úspěšnost <span className="text-emerald-400">{pct(stats.riskCorrect, stats.riskTotal)} %</span> (
        {stats.riskCorrect}/{stats.riskTotal})
      </div>
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-emerald-950/70 px-3 py-4 ring-1 ring-emerald-400/20">
        <div className="flex gap-1.5">
          {dice.map((v, i) => (
            <DieFace key={i} value={v as DieValue} size={46} />
          ))}
        </div>
        <p className="text-center text-sm font-bold">Jaká je šance na tropu, když teď přihodíte jednu kostku?</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {RISK_OPTIONS.map((v) => (
          <button
            key={v}
            type="button"
            disabled={answer !== null}
            onClick={() => submit(v)}
            className={`rounded-xl bg-slate-800 py-3 font-extrabold tabular-nums ring-1 ring-white/10 ${answer !== null && v === correct ? 'bg-emerald-500 text-slate-950' : ''} ${answer === v && v !== correct ? 'bg-rose-600' : ''}`}
          >
            {v} %
          </button>
        ))}
      </div>
      {answer !== null && (
        <div className={`rounded-xl p-3 text-sm ring-1 ${answer === correct ? 'bg-emerald-950 ring-emerald-500/50' : 'bg-rose-950/70 ring-rose-500/50'}`}>
          <p className="font-black">{answer === correct ? 'Správně!' : `Správně je ${correct} %`}</p>
          <p className="mt-1 text-slate-300">
            Tvrdý součet {hard}: bezpečné jsou hody {safeMax > 0 ? `1–${safeMax}` : 'žádné'} ({safeMax} z 6). Jednička
            se vždy může počítat jako 1, takže riziko určuje tvrdý součet.
          </p>
          <button
            type="button"
            onClick={() => {
              setDice(randomRiskHand());
              setAnswer(null);
            }}
            className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 font-extrabold text-slate-950"
          >
            Další
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Trenér ve hře + statistiky ----------

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 rounded-xl bg-slate-900 p-3 ring-1 ring-white/5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{label}</div>
        <div className="text-[11px] text-slate-400">{hint}</div>
      </div>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 ${checked ? 'bg-emerald-500' : 'bg-slate-700'}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
      </span>
    </label>
  );
}

function Coach({
  settings,
  onSettings,
  stats,
  onReset,
}: {
  settings: TrainerSettings;
  onSettings: (s: TrainerSettings) => void;
  stats: TrainerStats;
  onReset: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const rows: [string, string][] = [
    ['Rozhodnutí ve hře', `${pct(stats.gameCorrect, stats.gameDecisions)} % (${stats.gameCorrect}/${stats.gameDecisions})`],
    ['Ztráta chybami', `${(stats.gameEvLost * 100).toFixed(0)} % sázky celkem`],
    ['Dril', `${pct(stats.drillCorrect, stats.drillTotal)} % (${stats.drillCorrect}/${stats.drillTotal})`],
    ['Nejdelší série v drilu', String(stats.drillBest)],
    ['Odhad rizika', `${pct(stats.riskCorrect, stats.riskTotal)} % (${stats.riskCorrect}/${stats.riskTotal})`],
  ];
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        id="coach-toggle"
        label="Trenér ve hře"
        hint="Po každém tahu ukáže, jestli byl optimální."
        checked={settings.coach}
        onChange={(v) => onSettings({ ...settings, coach: v })}
      />
      <Toggle
        id="hints-toggle"
        label="Nápověda"
        hint="Zvýrazní doporučený tah na tlačítku."
        checked={settings.hints}
        onChange={(v) => onSettings({ ...settings, hints: v })}
      />
      <h3 className="mt-2 text-xs font-bold tracking-wider text-emerald-400 uppercase">Vaše statistiky</h3>
      <dl className="divide-y divide-white/5 rounded-xl bg-slate-900 ring-1 ring-white/5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-3 py-2 text-sm">
            <dt className="text-slate-400">{k}</dt>
            <dd className="font-bold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {confirm ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => { onReset(); setConfirm(false); }} className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-bold">
            Ano, vynulovat
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="flex-1 rounded-xl bg-slate-800 py-2 text-sm font-bold">
            Zpět
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="self-start text-xs text-rose-400 underline">
          Vynulovat statistiky
        </button>
      )}
    </div>
  );
}

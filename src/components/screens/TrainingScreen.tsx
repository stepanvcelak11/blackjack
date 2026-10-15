import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHARLIE_DICE, score, type DieValue } from '../../lib/gameRules';
import { hapticBust, hapticTap } from '../../lib/haptics';
import { playBust, playChip } from '../../lib/soundEffects';
import { advise, bustPercent, MOVE_LABEL, type Move, type Situation } from '../../lib/strategy';
import { pct, type TrainerStats } from '../../lib/trainerStore';
import { DieFace } from '../Die';
import { EvTable, MOVE_STYLE, SituationView } from '../trainer/ui';
import { ScreenShell, Segmented } from './ScreenShell';

type OnStats = (fn: (s: TrainerStats) => TrainerStats) => void;
type Mode = 'drill' | 'risk';

const MODES = [
  ['drill', 'Dril rozhodování'],
  ['risk', 'Odhad rizika'],
] as const;

export function TrainingScreen({ stats, onStats }: { stats: TrainerStats; onStats: OnStats }) {
  const [mode, setMode] = useState<Mode>('drill');
  return (
    <ScreenShell
      title="Trénink"
      subtitle={mode === 'drill' ? 'Vyberte nejlepší tah – jako v BJ Wiz' : 'Jak velká je šance na tropu?'}
      toolbar={<Segmented value={mode} options={MODES} onChange={setMode} label="Druh tréninku" />}
    >
      {mode === 'drill' ? <Drill stats={stats} onStats={onStats} /> : <RiskDrill stats={stats} onStats={onStats} />}
    </ScreenShell>
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

function Drill({ stats, onStats }: { stats: TrainerStats; onStats: OnStats }) {
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

function RiskDrill({ stats, onStats }: { stats: TrainerStats; onStats: OnStats }) {
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
        Kostky nemají paměť, takže počítání jako Hi-Lo u karet tu nefunguje. Místo toho trénujte okamžitý odhad rizika
        tropy.
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
        <div
          className={`rounded-xl p-3 text-sm ring-1 ${answer === correct ? 'bg-emerald-950 ring-emerald-500/50' : 'bg-rose-950/70 ring-rose-500/50'}`}
        >
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

import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { DieFace } from './Die';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function RulesModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-title"
        >
          <motion.div
            className="flex max-h-[88%] w-full flex-col rounded-t-3xl border-t border-amber-300/40 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200 shadow-2xl"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 id="rules-title" className="flex items-center gap-2 text-xl font-black text-amber-300">
                <DieFace value={6} size={26} tone="gold" /> Pravidla DiceJack 12
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="grid size-10 place-items-center rounded-full bg-white/10 active:bg-white/20"
                aria-label="Zavřít pravidla"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4 text-sm leading-relaxed">
              <Section title="Cíl hry">
                Dostaňte součet kostek co nejblíže k <b className="text-amber-300">12</b>, ale nepřekročte ho. Porazte
                krupiéra. Hraje se s klasickými kostkami 1–6.
              </Section>
              <Section title="Průběh kola">
                Vsaďte žetony a hoďte. Vy dostanete 2 kostky, krupiér také 2 – jedna je viditelná, druhá schovaná pod
                kelímkem až do konce vašeho tahu. Když má krupiér viditelnou šestku, nahlédne pod kelímek – pokud má
                DiceJack, kolo hned končí.
              </Section>
              <Section title="Akce">
                <ul className="space-y-1.5">
                  <li>
                    <b className="text-emerald-300">Přihodit</b> – hodíte další kostkou a přičtete ji.
                  </li>
                  <li>
                    <b className="text-rose-300">Stát</b> – ukončíte tah se současným součtem.
                  </li>
                  <li>
                    <b className="text-amber-300">Double</b> – jen se 2 kostkami: zdvojnásobíte sázku, hodíte právě
                    jednou kostkou a tah končí.
                  </li>
                  <li>
                    <b className="text-sky-300">Rozdělit</b> – při dvou stejných kostkách vznikne druhá ruka se stejnou
                    sázkou. Každá dostane další kostku a hrajete je postupně (levá, pak pravá) včetně Double.
                  </li>
                </ul>
              </Section>
              <Section title="Jednička = eso (měkká ruka)">
                <div className="flex items-start gap-2">
                  <DieFace value={1} size={30} />
                  <p>
                    Jednička se počítá jako <b>1 nebo 4</b>. Hra automaticky bere 4, pokud tím nepřetáhnete 12, jinak
                    se jednička „zlomí“ na 1. Měkkou ruku poznáte podle dvou hodnot (např. <b>5 / 8</b>) a štítku{' '}
                    <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-black text-white uppercase">
                      Měkká
                    </span>
                    .
                  </p>
                </div>
              </Section>
              <Section title="Tropa a automatický stop">
                Tvrdý součet 13 a více = <b className="text-red-400">tropa</b>, ruka okamžitě prohrává. Při přesně 12
                tah ruky končí automaticky.
              </Section>
              <Section title="4-Kostkový Charlie">
                Nasbíráte-li v jedné ruce <b>4 kostky</b> bez tropy, ruka okamžitě vyhrává <b>2 : 1</b> bez ohledu na
                krupiéra.
              </Section>
              <Section title="Bezpečný příhoz (d3) – Ostrostřelec">
                <div className="flex items-start gap-2">
                  <DieFace value={2} size={30} tone="metal" />
                  <p>
                    Při součtu <b>8, 9 nebo 10</b> si můžete koupit cinknutou kovovou kostku, na které padá jen{' '}
                    <b>1, 2 nebo 3</b>. Stojí <b>50 % sázky</b> ruky (nevratně) a lze ji použít jen jednou za kolo.
                  </p>
                </div>
              </Section>
              <Section title="Krupiér">
                Odkryje kelímek, až dohrajete. Přihazuje při součtu <b>8 a méně</b> a také na <b>měkkou 9</b> (např. 1 +
                5). Stojí na <b>tvrdé 9</b> a výš.
              </Section>
              <Section title="Výplaty">
                <table className="w-full text-left">
                  <tbody className="[&_td]:py-1">
                    <tr>
                      <td className="flex items-center gap-1">
                        <DieFace value={6} size={18} tone="gold" />
                        <DieFace value={6} size={18} tone="gold" />
                        <b className="ml-1 text-amber-300">DiceJack</b>
                      </td>
                      <td className="text-right font-bold">2 : 1</td>
                    </tr>
                    <tr>
                      <td>
                        <b className="text-fuchsia-300">4-Kostkový Charlie</b>
                      </td>
                      <td className="text-right font-bold">2 : 1</td>
                    </tr>
                    <tr>
                      <td>Výhra (blíž k 12 / krupiér v tropě)</td>
                      <td className="text-right font-bold">1 : 1</td>
                    </tr>
                    <tr>
                      <td>Shoda (remíza)</td>
                      <td className="text-right font-bold">vklad zpět</td>
                    </tr>
                    <tr>
                      <td>
                        Vedlejší sázka <b className="text-fuchsia-300">Pár</b> (2 stejné úvodní kostky)
                      </td>
                      <td className="text-right font-bold">4 : 1</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-400">
                  DiceJack platí jen z prvních dvou kostek (ne po rozdělení). Když DiceJack má i krupiér, je to remíza.
                  Sázku na pár zvolíte klepnutím na menší kruh vedle hlavní sázky – vyplácí se hned po rozdání a pár
                  pak můžete normálně rozdělit.
                </p>
              </Section>
              <Section title="Hot Streak 🔥">
                Při <b>3 vyhraných kolech v řadě</b> se rozhoří plamen kolem bankrollu. Každá další výhra v sérii
                dostane od kasina bonus <b>+20 %</b> z čisté výhry. Remíza sérii nepřeruší, prohra ano.
              </Section>
              <Section title="Ovládání">
                <b>Hodit kostky</b> a <b>Přihodit</b> stačí klepnout – nebo tlačítko <b>podržte</b>, kostky se v
                kelímku roztřesou a padnou, až prst pustíte.
              </Section>
              <Section title="Barva součtu">
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-emerald-950">≤ 6 bezpečné</span>
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-amber-950">7–9 pozor</span>
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-white">10–11 riskantní</span>
                  <span className="rounded-full bg-amber-300 px-2 py-0.5 text-amber-950">12 perfektní</span>
                </div>
              </Section>
              <p className="pb-2 text-center text-xs text-slate-500">
                Došly peníze? Kasino vám rádo půjčí – reset na 1 000 $.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-black uppercase tracking-widest text-emerald-300/90">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

import type React from 'react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  /** Pravý horní roh (např. akce). */
  right?: ReactNode;
  /** Řádek pod titulkem (segmentový přepínač kategorií). */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Ref na posuvný obsah (pro skok na kotvy). */
  scrollRef?: React.Ref<HTMLDivElement>;
}

/** Společná kostra obrazovek mimo stůl: titulek, volitelný přepínač a posuvný obsah. */
export function ScreenShell({ title, subtitle, right, toolbar, children, scrollRef }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/95 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black tracking-tight text-white">{title}</h1>
            {subtitle && <p className="text-xs font-semibold text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </div>
        {toolbar && <div className="mt-3">{toolbar}</div>}
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-6">
        {children}
      </div>
    </div>
  );
}

/** Segmentový přepínač kategorií. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-900 p-1 ring-1 ring-white/5" role="tablist" aria-label={label}>
      {options.map(([id, text]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={`min-w-0 flex-1 truncate rounded-lg px-1 py-2 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${value === id ? 'bg-slate-700 text-emerald-300 shadow' : 'text-slate-400 active:bg-slate-800'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

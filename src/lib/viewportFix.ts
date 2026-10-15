// Oprava výšky pro webovou aplikaci přidanou na plochu iPhonu (standalone).
// iOS v tomto režimu občas nahlásí výšku okna menší o horní a spodní bezpečnou
// zónu – stránka pak končí nad spodním okrajem a zbude prázdný pruh. Když to
// poznáme, roztáhneme aplikaci na skutečnou výšku displeje.

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || matchMedia('(display-mode: standalone)').matches;
}

function apply(): void {
  const root = document.documentElement;
  if (!isStandalone()) {
    root.classList.remove('ios-pwa-fix');
    return;
  }
  const portrait = innerHeight >= innerWidth;
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  const target = portrait ? long : short;
  const gap = target - innerHeight;
  // Jen typický případ chyby: okno má šířku displeje a chybí mu desítky bodů výšky.
  const fullWidth = Math.abs((portrait ? short : long) - innerWidth) < 2;
  if (fullWidth && gap > 0 && gap <= 160) {
    root.style.setProperty('--app-h', `${target}px`);
    root.classList.add('ios-pwa-fix');
  } else {
    root.classList.remove('ios-pwa-fix');
  }
}

export function installViewportFix(): void {
  if (typeof window === 'undefined') return;
  apply();
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', () => setTimeout(apply, 300));
  // iOS dopočítá rozměry až chvíli po spuštění.
  setTimeout(apply, 500);
}

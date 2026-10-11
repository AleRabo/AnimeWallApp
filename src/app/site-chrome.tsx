'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const themes = [
  { id: 'ph', label: 'PH' },
  { id: 'red', label: 'Rosso' },
  { id: 'green', label: 'Verde' },
  { id: 'pink', label: 'Rosa' },
  { id: 'pink-black', label: 'Rosa-Nero' },
  { id: 'green-black', label: 'Verde-Nero' }
] as const;

type ThemeId = typeof themes[number]['id'];

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeId>('ph');
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('animewall-theme');
    if (themes.some((item) => item.id === savedTheme)) setTheme(savedTheme as ThemeId);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('animewall-theme', theme);
  }, [theme, themeReady]);

  useEffect(() => {
    let animationFrame = 0;
    let direction = 0;
    let activeRow: HTMLElement | null = null;

    const moveRowsAtEdge = (event: MouseEvent) => {
      const edge = 92;
      direction = event.clientX < edge ? -1 : event.clientX > window.innerWidth - edge ? 1 : 0;
      activeRow = (event.target as HTMLElement).closest<HTMLElement>('[data-horizontal-row]');
    };

    const scrollAtEdge = () => {
      if (direction && activeRow) {
        activeRow.scrollLeft += direction * 7;
        animationFrame = window.requestAnimationFrame(scrollAtEdge);
      } else {
        animationFrame = 0;
      }
    };

    const startScrolling = (event: MouseEvent) => {
      moveRowsAtEdge(event);
      if (!animationFrame && direction && activeRow) animationFrame = window.requestAnimationFrame(scrollAtEdge);
    };

    window.addEventListener('mousemove', startScrolling);
    return () => {
      window.removeEventListener('mousemove', startScrolling);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/5 bg-black/95 px-5 py-4 shadow-2xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center gap-8">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-xl font-black text-black shadow-lg shadow-orange-500/20 transition-all duration-300 group-hover:scale-105">
                A
              </div>
              <div className="absolute -inset-1 -z-10 rounded-lg bg-orange-500/20 blur-sm transition-all group-hover:bg-orange-500/40" />
            </div>
            <span className="hidden text-xl font-black tracking-wider text-white sm:inline">
              ANIME<span className="text-orange-500">WALL</span>
            </span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto text-sm font-semibold text-neutral-400 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/" className={pathname === '/' ? 'text-white' : 'transition hover:text-white'}>Home</Link>
            <Link href="/search" className={pathname.startsWith('/search') ? 'text-white' : 'transition hover:text-white'}>Anime</Link>
            <Link href="/calendar" className={pathname.startsWith('/calendar') ? 'text-white' : 'transition hover:text-white'}>Calendario</Link>
            <Link href="/top-anime" className={pathname.startsWith('/top-anime') ? 'text-white' : 'transition hover:text-white'}>Top</Link>
            <Link href="/upcoming" className={pathname.startsWith('/upcoming') ? 'text-white' : 'transition hover:text-white'}>Prossime</Link>
            <Link href="/watch-together" className={pathname.startsWith('/watch-together') ? 'text-white' : 'transition hover:text-white'}>Watch Together</Link>
            <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-neutral-500">
              <span>🎨</span>
              <select
                aria-label="Seleziona tema"
                value={theme}
                onChange={(event) => setTheme(event.target.value as ThemeId)}
                className="max-w-24 cursor-pointer bg-transparent text-inherit outline-none"
              >
                {themes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
          </nav>
        </div>
      </header>

      {children}

    </>
  );
}
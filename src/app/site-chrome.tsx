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

const mascots: Record<ThemeId, string> = {
  ph: '/mascots/ph.png',
  red: '/mascots/rias-red.png',
  green: '/mascots/silence-suzuka.png',
  pink: '/mascots/rias-pink.png',
  'pink-black': '/mascots/rias-pink.png',
  'green-black': '/mascots/silence-suzuka.png'
};

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeId>('ph');
  const [themeReady, setThemeReady] = useState(false);
  const [mascotVisible, setMascotVisible] = useState(true);

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
    setMascotVisible(true);
  }, [theme, pathname]);

  const isWatchPage = pathname.startsWith('/watch');

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-[#0f1117]/80 px-4 py-3.5 shadow-2xl backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="group flex items-center gap-3">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-400 text-xl font-black text-black shadow-lg shadow-orange-500/30 transition-all duration-300 group-hover:scale-105 group-hover:shadow-orange-500/50">
                AW
              </div>
              <div className="absolute -inset-1 -z-10 rounded-2xl bg-orange-500/20 blur-sm transition-all group-hover:bg-orange-500/40" />
            </div>
            <span className="text-2xl font-black tracking-wider text-white">
              ANIME<span className="text-orange-500">WALL</span>
            </span>
          </Link>

          <nav className="flex w-full max-w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
            <Link href="/calendar" className="shrink-0 whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs font-bold text-neutral-300 transition-all hover:border-orange-500/50 hover:text-orange-400 sm:px-4 sm:text-sm">
              📅 Calendario
            </Link>
            <Link href="/top-anime" className="shrink-0 whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs font-bold text-neutral-300 transition-all hover:border-orange-500/50 hover:text-orange-400 sm:px-4 sm:text-sm">
              ⭐ Top Anime
            </Link>
            <Link href="/upcoming" className="shrink-0 whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs font-bold text-neutral-300 transition-all hover:border-orange-500/50 hover:text-orange-400 sm:px-4 sm:text-sm">
              ✨ Prossime uscite
            </Link>
            <Link href="/watch-together" className="shrink-0 whitespace-nowrap rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs font-bold text-neutral-300 transition-all hover:border-orange-500/50 hover:text-orange-400 sm:px-4 sm:text-sm">
              👥 Watch Together
            </Link>
            <label className="flex shrink-0 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-xs font-bold text-neutral-300 sm:text-sm">
              <span>🎨 Temi</span>
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

      {!isWatchPage && mascotVisible && (
        <img
          src={mascots[theme]}
          alt="Mascotte AnimeWall"
          onError={() => setMascotVisible(false)}
          className="pointer-events-none fixed bottom-0 right-0 z-30 h-[min(25vh,170px)] max-w-[34vw] object-contain object-bottom opacity-90 sm:h-[min(42vh,340px)] sm:max-w-[24vw]"
        />
      )}
    </>
  );
}
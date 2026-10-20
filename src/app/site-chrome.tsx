'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useGamepad } from '@/hooks/use-gamepad';

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
  useGamepad();
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
    let animationFrame = 0;
    let direction = 0;
    let activeRow: HTMLElement | null = null;
    let targetScroll = 0;

    const moveRowsAtEdge = (event: MouseEvent) => {
      const edge = 92;
      direction = event.clientX < edge ? -1 : event.clientX > window.innerWidth - edge ? 1 : 0;
      activeRow = direction
        ? Array.from(document.querySelectorAll<HTMLElement>('[data-horizontal-row]')).find((row) => {
            const bounds = row.getBoundingClientRect();
            return event.clientY >= bounds.top && event.clientY <= bounds.bottom;
          }) || null
        : null;
      if (activeRow && !animationFrame) targetScroll = activeRow.scrollLeft;
    };

    const scrollAtEdge = () => {
      if (direction && activeRow) {
        targetScroll += direction * 7;
        activeRow.scrollLeft += (targetScroll - activeRow.scrollLeft) * 0.14;
        animationFrame = window.requestAnimationFrame(scrollAtEdge);
      } else {
        animationFrame = 0;
      }
    };

    const startScrolling = (event: MouseEvent) => {
      moveRowsAtEdge(event);
      if (!animationFrame && direction && activeRow) animationFrame = window.requestAnimationFrame(scrollAtEdge);
    };

    const findRowAtPointer = (clientX: number, clientY: number) => {
      return Array.from(document.querySelectorAll<HTMLElement>('[data-horizontal-row]')).find((row) => {
        const bounds = row.getBoundingClientRect();
        return clientX >= bounds.left && clientX <= bounds.right
          && clientY >= bounds.top && clientY <= bounds.bottom;
      }) || null;
    };

    const scrollRowWithWheel = (event: WheelEvent) => {
      const row = findRowAtPointer(event.clientX, event.clientY);
      if (!row || row.scrollWidth <= row.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      activeRow = row;
      targetScroll = Math.max(0, Math.min(row.scrollWidth - row.clientWidth, row.scrollLeft + event.deltaY * 2));
      const animateWheel = () => {
        if (!activeRow) return;
        const distance = targetScroll - activeRow.scrollLeft;
        activeRow.scrollLeft += distance * 0.16;
        if (Math.abs(distance) > 0.5) {
          animationFrame = window.requestAnimationFrame(animateWheel);
        } else {
          activeRow.scrollLeft = targetScroll;
          animationFrame = 0;
        }
      };
      if (!animationFrame) animationFrame = window.requestAnimationFrame(animateWheel);
      event.preventDefault();
    };

    window.addEventListener('mousemove', startScrolling);
    window.addEventListener('wheel', scrollRowWithWheel, { passive: false });
    return () => {
      window.removeEventListener('mousemove', startScrolling);
      window.removeEventListener('wheel', scrollRowWithWheel);
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
                AW
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

      <aside className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-white/10 bg-[#08090c]/95 px-3 backdrop-blur-xl md:top-[73px] md:h-[calc(100vh-73px)] md:w-20 md:flex-col md:justify-center md:gap-8 md:border-r md:border-t-0 md:bg-[#08090c]/90">
        <Link href="/" aria-label="Home" className={`text-xl transition hover:text-white ${pathname === '/' ? 'text-white' : 'text-neutral-500'}`}>⌂</Link>
        <Link href="/search" aria-label="Cerca" className={`text-xl transition hover:text-white ${pathname.startsWith('/search') ? 'text-white' : 'text-neutral-500'}`}>⌕</Link>
        <Link href="/calendar" aria-label="Calendario" className={`text-xl transition hover:text-white ${pathname.startsWith('/calendar') ? 'text-white' : 'text-neutral-500'}`}>▦</Link>
        <Link href="/top-anime" aria-label="Top anime" className={`text-xl transition hover:text-white ${pathname.startsWith('/top-anime') ? 'text-white' : 'text-neutral-500'}`}>★</Link>
        <Link href="/watch-together" aria-label="Watch Together" className={`text-xl transition hover:text-white ${pathname.startsWith('/watch-together') ? 'text-white' : 'text-neutral-500'}`}>♧</Link>
      </aside>

      <div className="min-h-[calc(100vh-73px)] md:pl-20">{children}</div>

      {mascotVisible && (
        <img
          src={mascots[theme]}
          alt="Mascotte AnimeWall"
          onError={() => setMascotVisible(false)}
          className="pointer-events-none fixed bottom-0 right-2 z-30 h-[min(24vh,180px)] max-w-[25vw] object-contain object-bottom opacity-75 sm:right-5 sm:h-[min(32vh,260px)]"
        />
      )}
    </>
  );
}
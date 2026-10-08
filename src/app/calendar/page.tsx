'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Episode {
  id: string;
  animeId: string;
  title: string;
  episodeNumber: string;
  image: string;
  isDub: boolean;
  time?: string;
}

interface CalendarDay {
  date: string;
  label: string;
  episodes: Episode[];
}

const formatDate = (date: string) => new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'short'
}).format(new Date(`${date}T12:00:00`));

export default function CalendarPage() {
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [activeDay, setActiveDay] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calendar')
      .then((response) => {
        if (!response.ok) throw new Error('Calendario non disponibile');
        return response.json();
      })
      .then((data) => {
        const nextCalendar = data.calendar || [];
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const todayIndex = nextCalendar.findIndex((item: CalendarDay) => item.date === today);
        setCalendar(nextCalendar);
        setActiveDay(todayIndex >= 0 ? todayIndex : 0);
      })
      .catch((error) => console.error('❌ Errore calendario:', error))
      .finally(() => setLoading(false));
  }, []);

  const day = calendar[activeDay];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">AnimeWall / Programmazione</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white">Calendario Anime</h1>
        <p className="max-w-2xl text-sm text-neutral-400">
          Tutte le uscite aggiornate giorno per giorno, senza riferimenti esterni.
        </p>
      </header>

      {loading && (
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && calendar.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-8">
            {calendar.map((item, index) => (
              <button
                key={item.date}
                onClick={() => setActiveDay(index)}
                className={`min-h-20 rounded-2xl border p-3 text-left transition ${
                  activeDay === index
                    ? 'border-orange-500 bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                    : 'border-neutral-800 bg-[#151822] text-neutral-300 hover:border-orange-500/50'
                }`}
              >
                <span className="block text-xs font-black uppercase tracking-wider">{item.label}</span>
                <span className="mt-1 block text-sm font-bold opacity-75">{item.date ? formatDate(item.date) : 'Data non indicata'}</span>
                <span className="mt-2 block text-xs font-semibold opacity-70">
                  {item.episodes.length} {item.episodes.length === 1 ? 'uscita' : 'uscite'}
                </span>
              </button>
            ))}
          </div>

          <section className="rounded-3xl border border-neutral-800 bg-[#0f1117] p-5 sm:p-8">
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-neutral-800 pb-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-500">{day.label}</p>
                <h2 className="mt-1 text-2xl font-black text-white">{day.date ? `Uscite del ${formatDate(day.date)}` : 'Ultime uscite'}</h2>
              </div>
              <span className="rounded-full border border-neutral-700 bg-[#151822] px-3 py-1 text-xs font-bold text-neutral-400">
                {day.episodes.length} episodi
              </span>
            </div>

            {day.episodes.length === 0 ? (
              <p className="py-12 text-center text-sm text-neutral-500">Nessuna uscita disponibile per questo giorno.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {day.episodes.map((episode, index) => (
                  <Link
                    key={`${episode.animeId}-${episode.id}-${index}`}
                    href={`/anime/${encodeURIComponent(episode.animeId)}`}
                    className="group flex items-center gap-4 rounded-2xl border border-neutral-800 bg-[#151822] p-3 transition hover:border-orange-500/60 hover:bg-[#1a1e2a]"
                  >
                    <div className="h-20 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-900">
                      {episode.image && <img src={episode.image} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-bold text-neutral-100 group-hover:text-orange-400">{episode.title}</h3>
                      <div className="mt-2 flex items-center gap-2 text-xs font-black">
                        <span className="rounded-md bg-orange-500 px-2 py-1 text-black">Ep {episode.episodeNumber}</span>
                        <span className={episode.isDub ? 'text-yellow-500' : 'text-blue-400'}>{episode.isDub ? 'DUB' : 'SUB'}</span>
                        {episode.time && <span className="text-neutral-500">{episode.time}</span>}
                      </div>
                    </div>
                    <span className="text-lg text-neutral-500 transition group-hover:translate-x-1 group-hover:text-orange-500">→</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {!loading && calendar.length === 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-[#151822] py-20 text-center text-neutral-400">
          Calendario temporaneamente non disponibile.
        </div>
      )}
    </main>
  );
}
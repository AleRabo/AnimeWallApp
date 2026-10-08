'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UpcomingAnime {
  id: string;
  title: string;
  cover: string;
  isDub: boolean;
}

const seasonLabel = 'Autunno';
const seasonYear = 2026;

export default function UpcomingPage() {
  const [anime, setAnime] = useState<UpcomingAnime[]>([]);
  const [filter, setFilter] = useState<'all' | 'sub' | 'dub'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/upcoming?year=${seasonYear}&season=fall`)
      .then((response) => {
        if (!response.ok) throw new Error('Prossime uscite non disponibili');
        return response.json();
      })
      .then((data) => setAnime(data.anime || []))
      .catch((error) => console.error('❌ Errore prossime uscite:', error))
      .finally(() => setLoading(false));
  }, []);

  const filteredAnime = anime.filter((item) => {
    if (filter === 'dub') return item.isDub;
    if (filter === 'sub') return !item.isDub;
    return true;
  });

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">AnimeWall / Prossime uscite</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white">Anime in arrivo</h1>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-neutral-400">Le uscite della stagione {seasonLabel} {seasonYear} raccolte da AnimeWall.</p>
          <div className="flex items-center gap-2 self-start rounded-xl border border-neutral-800 bg-[#151822] p-1.5 sm:self-auto">
            {(['all', 'sub', 'dub'] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filter === option ? 'bg-orange-500 text-black shadow-md' : 'text-neutral-400 hover:text-white'}`}
              >
                {option === 'all' ? 'Tutti' : option === 'sub' ? 'Sub-ITA' : 'Dub-ITA'}
              </button>
            ))}
          </div>
        </div>
      </header>

      {loading && <div className="py-20 flex justify-center"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}

      {!loading && anime.length === 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-[#151822] py-20 text-center text-neutral-400">
          Prossime uscite temporaneamente non disponibili.
        </div>
      )}

      {!loading && filteredAnime.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
          {filteredAnime.map((item) => (
            <Link
              key={item.id}
              href={`/anime/${encodeURIComponent(item.id)}`}
              className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-800/80 bg-[#151822] transition-all hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10"
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-neutral-900">
                {item.cover && <img src={item.cover} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
              </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 text-sm font-bold leading-snug text-neutral-200 group-hover:text-orange-400">{item.title}</h2>
                  <span className={`mt-2 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-black ${item.isDub ? 'bg-yellow-500 text-black' : 'bg-blue-600 text-white'}`}>
                    {item.isDub ? 'DUB' : 'SUB'}
                  </span>
                </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && anime.length > 0 && filteredAnime.length === 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-[#151822] py-16 text-center text-neutral-400">
          Nessuna uscita disponibile per questo filtro.
        </div>
      )}
    </main>
  );
}
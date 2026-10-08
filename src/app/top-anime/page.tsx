'use client';

import { useEffect, useState } from 'react';

interface TopAnime {
  rank: number;
  id: string;
  title: string;
  url: string;
  image: string;
  score: string;
  type: string;
  episodes: string;
  members: string;
}

export default function TopAnimePage() {
  const [anime, setAnime] = useState<TopAnime[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/top-anime?page=${page}&v=2`, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Classifica non disponibile');
        return response.json();
      })
      .then((data) => {
        setAnime(data.anime || []);
        setHasNext(Boolean(data.hasNext));
      })
      .catch((error) => {
        console.error('❌ Errore classifica:', error);
        setAnime([]);
        setHasNext(false);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">AnimeWall / Classifica</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white">Top Anime</h1>
        <p className="text-sm text-neutral-400">I migliori anime secondo MyAnimeList, 25 titoli per pagina.</p>
      </header>

      {loading && (
        <div className="py-20 flex justify-center"><div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
      )}

      {!loading && anime.length === 0 && (
        <div className="rounded-2xl border border-neutral-800 bg-[#151822] py-20 text-center text-neutral-400">
          Classifica temporaneamente non disponibile.
        </div>
      )}

      {!loading && anime.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-neutral-800 bg-[#0f1117]">
          <div className="divide-y divide-neutral-800">
            {anime.map((item) => (
              <div
                key={`${item.id}-${item.rank}`}
                className="top-anime-row group flex items-center gap-3 p-3 transition hover:bg-[#151822] sm:gap-5 sm:p-4"
              >
                <span className="w-8 shrink-0 text-center text-lg font-black text-orange-500 sm:w-12 sm:text-2xl">{item.rank}</span>
                <a href={`/search?q=${encodeURIComponent(item.title)}`} className="h-20 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-900 sm:h-24 sm:w-16">
                  {item.image && <img src={item.image} alt={item.title} className="h-full w-full object-cover transition group-hover:scale-105" />}
                </a>
                <div className="min-w-0 flex-1">
                  <a href={`/search?q=${encodeURIComponent(item.title)}`} className="line-clamp-2 text-sm font-bold text-neutral-100 hover:text-orange-400 sm:text-base">{item.title}</a>
                  <p className="mt-1 text-xs text-neutral-500">{item.type || 'Anime'} · {item.episodes} episodi{item.members ? ` · ${item.members} membri` : ''}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-lg font-black text-yellow-400">{item.score || 'N/A'}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">score</span>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-2 text-xs font-black text-neutral-400 transition hover:border-orange-500 hover:text-orange-400"
                >
                  MAL
                </a>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-800 p-4">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1 || loading}
              className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-bold text-neutral-300 transition hover:border-orange-500 hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Precedente
            </button>
            <span className="text-sm font-black text-neutral-400">Pagina {page}</span>
            <button
              onClick={() => setPage((current) => current + 1)}
              disabled={!hasNext || loading}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-black transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Successiva →
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
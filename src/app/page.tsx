'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CONTINUE_WATCHING_EVENT,
  getContinueWatching,
  removeContinueWatching,
  type ContinueWatchingItem
} from '@/lib/continue-watching';

interface LatestEpisode {
  id: string;
  animeId: string;
  title: string;
  episodeNumber: string;
  image: string;
  isDub: boolean;
  isSub: boolean;
}

interface FeaturedAnime {
  animeId: string;
  title: string;
  description: string;
  image: string;
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [latestEpisodes, setLatestEpisodes] = useState<LatestEpisode[]>([]);
  const [featuredAnime, setFeaturedAnime] = useState<FeaturedAnime | null>(null);
  const [filter, setFilter] = useState<'all' | 'sub' | 'dub'>('all');
  const [loading, setLoading] = useState(true);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);

  useEffect(() => {
    const update = () => setContinueWatching(getContinueWatching().filter((item) => !item.completed));
    update();
    window.addEventListener(CONTINUE_WATCHING_EVENT, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(CONTINUE_WATCHING_EVENT, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [latestResponse, featuredResponse] = await Promise.all([
          fetch('/api/latest'),
          fetch('/api/featured')
        ]);

        if (latestResponse.ok) {
          const latestData = await latestResponse.json();
          if (latestData.episodes) setLatestEpisodes(latestData.episodes);
        } else {
          console.warn('⚠️ Impossibile caricare gli ultimi episodi');
        }

        if (featuredResponse.ok) {
          const featuredData = await featuredResponse.json();
          if (featuredData.featured?.length > 0) setFeaturedAnime(featuredData.featured[0]);
        }
      } catch (err) {
        console.error('❌ Errore durante il recupero dei dati:', err);
      } finally {
        setLoading(false);
      }
    };

  fetchData();
}, []);

  // Filtraggio degli episodi (Tutti, Sub-ITA, Dub-ITA)
  const filteredEpisodes = latestEpisodes.filter((ep) => {
    if (filter === 'sub') return ep.isSub;
    if (filter === 'dub') return ep.isDub;
    return true;
  });

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-8">
        
        <p className="mx-auto max-w-4xl rounded-2xl border border-neutral-800 bg-[#0f1117] px-5 py-4 text-center text-sm leading-relaxed text-neutral-300">
          Questo sito offre anime gratis, ma ricorda che se hai possibilità supporta gli studi d'animazione usando siti officiali.
        </p>

        {continueWatching.length > 0 && (
          <section className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-wider text-white">
                <span className="inline-block h-6 w-2.5 rounded-full bg-orange-500" />
                Continua a guardare
              </h2>
              <span className="text-xs font-bold text-neutral-500">Salvato su questo dispositivo</span>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {continueWatching.slice(0, 12).map((item) => {
                const progress = item.duration > 0
                  ? Math.min(100, Math.round((item.currentTime / item.duration) * 100))
                  : 0;
                return (
                  <div key={`${item.animeId}-${item.episodeId}`} className="group relative overflow-hidden rounded-2xl border border-neutral-800 bg-[#151822]">
                    <Link href={`/watch?anime=${encodeURIComponent(item.animeId)}&ep=${encodeURIComponent(item.episodeId)}`}>
                      <div className="relative aspect-[2/3] bg-neutral-900">
                        {item.cover ? <img src={item.cover} alt={item.title} className="h-full w-full object-cover transition group-hover:scale-105" /> : (
                          <div className="flex h-full items-center justify-center p-3 text-center text-xs font-bold text-neutral-500">Nessuna copertina</div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-3 pt-12">
                          <p className="line-clamp-2 text-sm font-black text-white">{item.title}</p>
                          <p className="mt-1 text-xs font-bold text-orange-400">Episodio {item.episodeNumber || '?'}</p>
                        </div>
                      </div>
                      <div className="h-1 bg-neutral-800"><div className="h-full bg-orange-500" style={{ width: `${progress}%` }} /></div>
                      <p className="px-3 py-2 text-xs font-bold text-neutral-400">{progress > 0 ? `${progress}% completato` : 'Non ancora iniziato'}</p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeContinueWatching(item.animeId, item.episodeId)}
                      aria-label={`Rimuovi ${item.title} dalla cronologia`}
                      className="absolute right-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-xs font-black text-white opacity-0 transition hover:bg-red-500 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 🔍 BARRA DI RICERCA */}
      <section className="w-full">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
            }
          }}
          className="relative max-w-3xl mx-auto"
        >
          <input
            type="text"
            placeholder="Cerca un anime per titolo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#151822] border border-neutral-800 rounded-2xl px-6 py-4 text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition shadow-xl text-lg"
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-black font-extrabold px-6 py-2.5 rounded-xl transition shadow-lg shadow-orange-500/20"
          >
            Cerca
          </button>
        </form>
      </section>

      {/* 🎬 HERO BANNER IN EVIDENZA (Stile AnimeWall) */}
      {featuredAnime && (
        <section className="relative w-full rounded-3xl overflow-hidden border border-neutral-800 bg-[#12131a] shadow-2xl min-h-[320px] flex items-end">
          {featuredAnime.image && (
            <div className="absolute inset-0 z-0">
              <img
                src={featuredAnime.image}
                alt={featuredAnime.title}
                className="w-full h-full object-cover opacity-40 blur-sm scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1015] via-[#0f1015]/70 to-transparent" />
            </div>
          )}

          <div className="relative z-10 p-6 sm:p-10 max-w-3xl flex flex-col gap-3">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {featuredAnime.title}
            </h1>
            {featuredAnime.description && (
              <p className="text-sm sm:text-base text-neutral-300 line-clamp-3 leading-relaxed">
                {featuredAnime.description}
              </p>
            )}
            <div className="mt-2">
              <Link
                href={`/anime/${encodeURIComponent(featuredAnime.animeId)}`}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black font-black px-6 py-3 rounded-2xl transition shadow-lg shadow-orange-500/20"
              >
                ▶ Guarda Ora
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 📺 ULTIMI EPISODI / NUOVE USCITE */}
      <section className="flex flex-col gap-6">
        {/* Intestazione e Filtri */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <h2 className="text-xl font-black tracking-wider uppercase text-white flex items-center gap-2">
            <span className="w-2.5 h-6 bg-orange-500 rounded-full inline-block" />
            Ultimi Episodi
          </h2>

          {/* TAB FILTRI (TUTTI / SUB-ITA / DUB-ITA) */}
          <div className="flex items-center gap-2 bg-[#151822] p-1.5 rounded-xl border border-neutral-800 w-fit">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'all'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Tutti
            </button>
            <button
              onClick={() => setFilter('sub')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'sub'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sub-ITA
            </button>
            <button
              onClick={() => setFilter('dub')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${
                filter === 'dub'
                  ? 'bg-orange-500 text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Dub-ITA
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 flex justify-center items-center">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Griglia Card Episodi */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {filteredEpisodes.slice(0, 20).map((ep, index) => (
              <Link
                key={`${ep.animeId}-${ep.id}-${index}`}
                href={`/watch?anime=${encodeURIComponent(ep.animeId)}&ep=${encodeURIComponent(ep.id)}`}
                className="group flex flex-col bg-[#151822] border border-neutral-800/80 rounded-2xl overflow-hidden hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300"
              >
                {/* Immagine con Badge Ep e DUB/SUB */}
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-900">
                  <img
                    src={ep.image}
                    alt={ep.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  
                  {/* Badge Numero Episodio */}
                  <span className="absolute bottom-2 left-2 bg-orange-500 text-black text-[11px] font-black px-2 py-0.5 rounded-md shadow-md">
                    Ep {ep.episodeNumber}
                  </span>

                  {/* Badge Dub / Sub */}
                  {ep.isDub ? (
                    <span className="absolute bottom-2 right-2 bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md">
                      DUB
                    </span>
                  ) : (
                    <span className="absolute bottom-2 right-2 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md">
                      SUB
                    </span>
                  )}
                </div>

                {/* Titolo Anime */}
                <div className="p-3">
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-200 group-hover:text-orange-400 line-clamp-2 transition-colors leading-snug">
                    {ep.title}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      </main>
    </>
  );
}
'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { getAnimeDetails } from '@/lib/api';

interface Episode {
  id: string;
  number: string;
  link: string;
}

interface AnimeDetails {
  id: string;
  title: string;
  cover: string;
  plot: string;
  genres: string[];
  status: string;
  episodes: Episode[];
  metadata: Record<string, string>;
  related: RelatedAnime[];
}

interface RelatedAnime {
  id: string;
  title: string;
  cover: string;
  info: string;
  isDub: boolean;
}

export default function AnimePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [anime, setAnime] = useState<AnimeDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnimeDetails(id)
      .then((data) => {
        if (data.success) setAnime(data.anime || data.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-orange-500 font-bold text-lg">
          <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          Caricamento scheda anime...
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h2 className="text-2xl font-bold text-neutral-300">Anime non trovato</h2>
        <Link href="/" className="bg-orange-500 text-black font-extrabold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition">
          Torna alla Home
        </Link>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Banner Principale */}
      <div className="relative rounded-3xl bg-[#0f1117] border border-neutral-800 p-6 sm:p-10 mb-10 overflow-hidden shadow-2xl">
        {anime.cover && (
          <div
            className="absolute inset-0 bg-cover bg-center blur-3xl opacity-20 scale-125 pointer-events-none"
            style={{ backgroundImage: `url(${anime.cover})` }}
          />
        )}

        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
         {/* Cover Anime */}
          <div className="w-52 sm:w-64 flex-shrink-0 mx-auto md:mx-0 rounded-2xl overflow-hidden border-2 border-orange-500/40 shadow-2xl shadow-orange-500/10 bg-neutral-900">
            {anime.cover ? (
              <img 
                src={anime.cover} 
                alt={anime.title} 
                className="w-full h-auto max-h-[380px] object-cover rounded-2xl" 
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center p-4 text-neutral-500 font-bold text-sm text-center">
                📷 Nessuna copertina disponibile
              </div>
            )}
          </div>

          {/* Dettagli Testuali */}
          <div className="flex-1 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {anime.status && (
                <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-black px-3 py-1 rounded-full">
                  {anime.status}
                </span>
              )}
              {anime.episodes.length > 0 && (
                <span className="bg-neutral-800/90 text-neutral-300 border border-neutral-700 text-xs font-bold px-3 py-1 rounded-full">
                  {anime.episodes.length} Episodi
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight">
              {anime.title}
            </h1>

            {anime.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {anime.genres.map((g) => (
                  <span key={g} className="bg-neutral-900/90 border border-neutral-800 text-xs text-neutral-300 font-semibold px-3 py-1 rounded-lg">
                    {g}
                  </span>
                ))}
              </div>
            )}

            <p className="text-neutral-300 text-sm sm:text-base leading-relaxed bg-[#08090d]/80 p-5 rounded-2xl border border-neutral-800/80 max-h-52 overflow-y-auto">
              {anime.plot || 'Nessuna trama disponibile.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-8 mb-10">
        <section className="rounded-3xl border border-neutral-800 bg-[#0f1117] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-3 h-7 bg-orange-500 rounded-full" />
            <h2 className="text-xl font-bold text-white">Informazioni</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            {Object.entries(anime.metadata || {}).map(([label, value]) => (
              <div key={label} className="border-b border-neutral-800/80 pb-3">
                <p className="text-[11px] font-black uppercase tracking-wider text-neutral-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-neutral-200">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {anime.related?.length > 0 && (
          <section className="rounded-3xl border border-neutral-800 bg-[#0f1117] p-5 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-3 h-7 bg-orange-500 rounded-full" />
              <h2 className="text-xl font-bold text-white">Correlati</h2>
            </div>
            <div className="flex flex-col gap-3 max-h-[560px] overflow-y-auto pr-1">
              {anime.related.map((related) => (
                <Link
                  key={related.id}
                  href={`/anime/${encodeURIComponent(related.id)}`}
                  className="group flex items-center gap-3 rounded-2xl border border-neutral-800 bg-[#151822] p-2.5 transition hover:border-orange-500/60"
                >
                  <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-neutral-900">
                    {related.cover && <img src={related.cover} alt={related.title} className="h-full w-full object-cover transition group-hover:scale-105" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-bold text-neutral-200 group-hover:text-orange-400">{related.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="line-clamp-2 text-xs text-neutral-500">{related.info}</p>
                      <span className={related.isDub
                        ? 'rounded-md bg-yellow-500 px-1.5 py-0.5 text-[10px] font-black text-black'
                        : 'rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white'}
                      >
                        {related.isDub ? 'DUB' : 'SUB'}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Lista Episodi - Link Sicuro Senza 404 */}
      <section className="bg-[#0f1117] rounded-3xl border border-neutral-800 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-3 h-7 bg-orange-500 rounded-full" />
          <h2 className="text-xl font-bold text-white">Scegli un Episodio</h2>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {anime.episodes.map((ep) => (
            <Link 
              key={ep.id} 
              href={`/watch?anime=${encodeURIComponent(anime.id)}&ep=${encodeURIComponent(ep.id)}`}
            >
              <div className="bg-[#151822] hover:bg-gradient-to-r hover:from-orange-500 hover:to-amber-500 hover:text-black border border-neutral-800 hover:border-orange-500 text-neutral-200 text-center py-3 rounded-xl font-black transition-all duration-200 cursor-pointer shadow-md active:scale-95 text-sm sm:text-base">
                Ep. {ep.number}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
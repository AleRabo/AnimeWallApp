'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface SearchResult {
  id: string;
  title: string;
  image?: string;
  poster?: string;
  cover?: string;
  img?: string;
  type?: string;
  isDub?: boolean;
  isSub?: boolean;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchInput, setSearchInput] = useState(query);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSearchInput(query);
    if (!query) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Errore nella ricerca');
        return res.json();
      })
      .then((data) => {
        const animeList = Array.isArray(data) ? data : data.anime || data.results || [];
        setResults(animeList);
      })
      .catch((err) => {
        console.error('❌ Errore ricerca:', err);
        setResults([]);
      })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const nextQuery = searchInput.trim();
          if (nextQuery) window.location.href = `/search?q=${encodeURIComponent(nextQuery)}`;
        }}
        className="relative max-w-3xl mx-auto w-full"
      >
        <input
          type="text"
          placeholder="Cerca un anime per titolo..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className="w-full bg-[#151822] border border-neutral-800 rounded-2xl px-6 py-4 text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition shadow-xl text-lg"
        />
        <button
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-black font-extrabold px-6 py-2.5 rounded-xl transition shadow-lg shadow-orange-500/20"
        >
          Cerca
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          Risultati per: <span className="text-orange-500">&quot;{query}&quot;</span>
        </h1>
        <p className="text-sm text-neutral-400">
          Trovati {results.length} anime corrispondenti alla tua ricerca.
        </p>
      </div>

      {loading && (
        <div className="py-20 flex justify-center items-center">
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="py-20 text-center text-neutral-400 bg-[#151822] rounded-2xl border border-neutral-800">
          Nessun anime trovato per questa ricerca.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {results.slice(0, 20).map((anime, index) => {
            // Controlla tutte le possibili chiavi con cui il backend invia l'immagine
            const imageUrl = anime.image || anime.poster || anime.cover || anime.img || '';
            // Fallback sul titolo se il backend non espone il flag (es. risposte in cache)
            const isDub = anime.isDub ?? anime.title.toLowerCase().includes('(ita)');

            return (
              <Link
                key={`${anime.id}-${index}`}
                href={`/anime/${encodeURIComponent(anime.id)}`}
                className="group flex flex-col bg-[#151822] border border-neutral-800/80 rounded-2xl overflow-hidden hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300"
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-900">
                  <img
                    src={imageUrl}
                    alt={anime.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                        // Corretto usando HTMLElement o any
                        (e.target as HTMLElement).style.display = 'none';
                    }}
                  />

                  {/* Badge Dub / Sub */}
                  {isDub ? (
                    <span className="absolute bottom-2 right-2 bg-yellow-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md">
                      DUB
                    </span>
                  ) : (
                    <span className="absolute bottom-2 right-2 bg-blue-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-md">
                      SUB
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="text-xs sm:text-sm font-bold text-neutral-200 group-hover:text-orange-400 line-clamp-2 transition-colors leading-snug">
                    {anime.title}
                  </h3>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { getEpisodeStream } from '@/lib/api';

interface StreamData {
  embedUrl?: string;
  streamUrl?: string;
  title?: string;
}

export default function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ anime?: string; ep?: string }>;
}) {
  const { anime: animeId, ep: episodeId } = use(searchParams);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!animeId || !episodeId) {
      setLoading(false);
      return;
    }

    getEpisodeStream(animeId, episodeId)
      .then((data) => {
        if (data.success || data.embedUrl || data.streamUrl) {
          setStreamData(data);
        } else {
          setError('Impossibile caricare il video dell\'episodio.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Errore di connessione al server per lo streaming.');
      })
      .finally(() => setLoading(false));
  }, [animeId, episodeId]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-orange-500 font-bold text-lg">
          <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          Caricamento lettore video...
        </div>
      </div>
    );
  }

  if (error || !streamData || (!streamData.embedUrl && !streamData.streamUrl)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h2 className="text-2xl font-bold text-neutral-300">
          {error || 'Episodio non trovato'}
        </h2>
        <Link
          href="/"
          className="bg-orange-500 text-black font-extrabold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition"
        >
          Torna alla Home
        </Link>
      </div>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Player Video */}
      <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-2xl">
        {streamData.embedUrl ? (
          <iframe
            src={streamData.embedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media"
          />
        ) : (
          <video
            src={streamData.streamUrl}
            controls
            autoPlay
            className="w-full h-full"
          />
        )}
      </div>
    </main>
  );
}
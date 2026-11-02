'use client';

import { useCallback, useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import { getEpisodeStream } from '@/lib/api';
import { getContinueWatching, saveContinueWatching } from '@/lib/continue-watching';

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
  const playerRef = useRef<HTMLDivElement>(null);

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

  const togglePlayback = useCallback(() => {
    const video = playerRef.current?.querySelector('video');
    if (video) {
      if (video.paused) void video.play();
      else video.pause();
      return;
    }
    playerRef.current?.querySelector('iframe')?.contentWindow?.postMessage(
      { type: 'animewall-control', action: 'play-pause' },
      window.location.origin
    );
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const player = playerRef.current;
      if (!player || (event.target instanceof Node && !player.contains(event.target))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      togglePlayback();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [togglePlayback]);

  useEffect(() => {
    if (!animeId || !episodeId || !streamData) return;
    const existing = getContinueWatching().find(
      (item) => item.animeId === animeId && item.episodeId === episodeId
    );
    const save = (currentTime: number, duration: number, completed = false) => {
      if (!Number.isFinite(currentTime) || currentTime < 0) return;
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      saveContinueWatching({
        animeId,
        episodeId,
        title: streamData.title || animeId,
        cover: '',
        episodeNumber: episodeId,
        currentTime,
        duration: safeDuration,
        completed: completed || (safeDuration > 0 && currentTime / safeDuration >= 0.93),
        updatedAt: Date.now()
      });
    };
    const video = playerRef.current?.querySelector('video');
    const saveVideo = () => {
      if (video) save(video.currentTime, video.duration, video.ended);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== playerRef.current?.querySelector('iframe')?.contentWindow) return;
      const data = event.data as { type?: string; currentTime?: number; duration?: number };
      if (data.type === 'animewall-playback' && typeof data.currentTime === 'number') {
        save(data.currentTime, data.duration || 0);
      }
    };
    if (video) {
      if (existing && existing.currentTime > 5) video.currentTime = existing.currentTime;
      video.addEventListener('timeupdate', saveVideo);
      video.addEventListener('pause', saveVideo);
      video.addEventListener('ended', saveVideo);
    }
    window.addEventListener('message', onMessage);
    return () => {
      video?.removeEventListener('timeupdate', saveVideo);
      video?.removeEventListener('pause', saveVideo);
      video?.removeEventListener('ended', saveVideo);
      window.removeEventListener('message', onMessage);
    };
  }, [animeId, episodeId, streamData]);

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
      <div ref={playerRef} className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-2xl">
        {streamData.embedUrl ? (
          <iframe
            src={streamData.embedUrl}
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
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
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={`/watch-together?anime=${encodeURIComponent(animeId || '')}&ep=${encodeURIComponent(episodeId || '')}`}
          className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500 hover:text-black"
        >
          Guarda insieme
        </Link>
        <p className="self-center text-xs text-neutral-500">Spazio: play/pausa</p>
      </div>
    </main>
  );
}
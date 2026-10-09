'use client';

import { useEffect, useRef, useState, use } from 'react';
import Link from 'next/link';
import { getAnimeDetails, getEpisodeStream } from '@/lib/api';
import { getContinueWatching, saveContinueWatching } from '@/lib/continue-watching';

interface Episode {
  id: string;
  number?: string | number;
  title?: string;
}

interface ServerOption {
  id: string;
  name: string;
}

export default function WatchPage({
  searchParams,
}: {
  searchParams: Promise<{ anime?: string; ep?: string }>;
}) {
  const resolvedParams = use(searchParams);
  const animeId = resolvedParams.anime || '';
  const episodeId = resolvedParams.ep || '';

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [activeServer, setActiveServer] = useState<string>('');
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [episodesError, setEpisodesError] = useState('');
  const [streamEpisodeNumber, setStreamEpisodeNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [animeTitle, setAnimeTitle] = useState(animeId || 'Anime');
  const [animeCover, setAnimeCover] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerFrameRef = useRef<HTMLIFrameElement>(null);
  const episodeNumberForHistory =
    episodes.find((episode) => String(episode.id) === String(episodeId))?.number
    || streamEpisodeNumber
    || episodeId;

  // 1. Recupera la lista ufficiale degli episodi dell'anime per la navigazione
  useEffect(() => {
    if (!animeId) {
      setEpisodesLoading(false);
      return;
    }

    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodesError('');
    fetch(`/api/anime/${encodeURIComponent(animeId)}/episodes`)
      .then((response) => {
        if (!response.ok) throw new Error('Lista episodi temporaneamente non disponibile.');
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
      })
      .catch((err) => {
        console.error('❌ Errore durante il recupero dei dettagli dell\'anime:', err);
        if (!cancelled) setEpisodesError(err instanceof Error ? err.message : 'Errore caricando gli episodi.');
      })
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false);
      });

    return () => { cancelled = true; };
  }, [animeId]);

  // 2. Recupera lo stream dell'episodio
  const fetchStream = (serverId?: string) => {
    setLoading(true);
    setError('');

    getEpisodeStream(animeId, episodeId, serverId)
      .then((data) => {
        const streamObj = data.stream || data.data || data;
        const foundUrl = 
          streamObj.embedUrl || 
          streamObj.streamUrl || 
          streamObj.url || 
          streamObj.link || 
          data.embedUrl;

        if (foundUrl) {
          setVideoUrl(foundUrl);
        } else {
          setError('Nessuna sorgente video disponibile.');
        }
        setStreamEpisodeNumber(String(streamObj.episodeNumber || ''));

        if (data.servers && Array.isArray(data.servers)) {
          setServers(data.servers);
        }
        if (data.activeServer) {
          setActiveServer(data.activeServer);
        }
      })
      .catch((err) => {
        console.error('❌ Errore getEpisodeStream:', err);
        setError('Errore durante il recupero dello streaming.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!animeId || !episodeId) {
      setError('Parametri della pagina non validi.');
      setLoading(false);
      return;
    }

    fetchStream();
  }, [animeId, episodeId]);

  useEffect(() => {
    if (!animeId) return;
    getAnimeDetails(animeId)
      .then((data) => {
        const anime = data.anime || data.data;
        if (anime?.title) setAnimeTitle(anime.title);
        if (anime?.cover || anime?.coverUrl || anime?.image) {
          setAnimeCover(anime.cover || anime.coverUrl || anime.image);
        }
      })
      .catch((err) => console.error('Errore recuperando i metadati per la cronologia:', err));
  }, [animeId]);

  useEffect(() => {
    if (!animeId || !episodeId || !videoUrl) return;

    const previous = getContinueWatching().find(
      (item) => item.animeId === animeId && item.episodeId === episodeId
    );
    const save = (currentTime: number, duration: number, paused: boolean) => {
      if (!Number.isFinite(currentTime) || currentTime < 0) return;
      const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      saveContinueWatching({
        animeId,
        episodeId,
        title: animeTitle,
        cover: animeCover,
        episodeNumber: String(episodeNumberForHistory),
        currentTime,
        duration: safeDuration,
        completed: safeDuration > 0 && currentTime >= safeDuration - 15,
        updatedAt: Date.now()
      });
      void paused;
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== playerFrameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; currentTime?: number; duration?: number; paused?: boolean };
      if (data.type === 'animewall-playback' && typeof data.currentTime === 'number') {
        save(data.currentTime, data.duration || 0, Boolean(data.paused));
      }
    };

    const restoreFrame = () => {
      if (previous && previous.currentTime > 5) {
        playerFrameRef.current?.contentWindow?.postMessage(
          { type: 'animewall-control', currentTime: previous.currentTime, paused: true },
          window.location.origin
        );
      }
    };

    const video = videoRef.current;
    const restoreVideo = () => {
      if (video && previous && previous.currentTime > 5) video.currentTime = previous.currentTime;
    };
    const saveVideo = () => {
      if (video) save(video.currentTime, video.duration, video.paused);
    };

    save(previous?.currentTime || 0, previous?.duration || 0, true);
    window.addEventListener('message', handleMessage);
    video?.addEventListener('loadedmetadata', restoreVideo);
    video?.addEventListener('timeupdate', saveVideo);
    video?.addEventListener('pause', saveVideo);
    video?.addEventListener('ended', saveVideo);
    restoreFrame();
    const restoreTimers = previous && previous.currentTime > 5
      ? [150, 500, 1200].map((delay) => window.setTimeout(restoreFrame, delay))
      : [];

    return () => {
      window.removeEventListener('message', handleMessage);
      video?.removeEventListener('loadedmetadata', restoreVideo);
      video?.removeEventListener('timeupdate', saveVideo);
      video?.removeEventListener('pause', saveVideo);
      video?.removeEventListener('ended', saveVideo);
      restoreTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [animeId, episodeId, videoUrl, animeTitle, animeCover, episodeNumberForHistory]);

  // 3. Calcola l'episodio precedente e successivo cercando nell'array reale
  const currentEpIndex = episodes.findIndex(
    (ep) => String(ep.id) === String(episodeId) || String(ep.number) === String(episodeId)
  );

  const prevEp = currentEpIndex > 0 ? episodes[currentEpIndex - 1] : null;
  const nextEp =
    currentEpIndex !== -1 && currentEpIndex < episodes.length - 1
      ? episodes[currentEpIndex + 1]
      : null;

  const currentEpDisplay =
    currentEpIndex !== -1
      ? episodes[currentEpIndex]?.number || currentEpIndex + 1
      : streamEpisodeNumber || '...';

  if (loading && !videoUrl) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-orange-500 font-bold text-lg">
          <div className="w-7 h-7 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          Caricamento lettore video...
        </div>
      </div>
    );
  }

  if (error || !videoUrl) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-4">
        <h2 className="text-2xl font-bold text-neutral-300">
          {error || 'Episodio non trovato'}
        </h2>
        <Link
          href={animeId ? `/anime/${encodeURIComponent(animeId)}` : '/'}
          className="bg-orange-500 text-black font-extrabold px-6 py-2.5 rounded-xl hover:bg-orange-600 transition"
        >
          Torna alla scheda anime
        </Link>
      </div>
    );
  }

const isDirectMedia = videoUrl.includes('.mp4') || videoUrl.includes('.m3u8');
  const isSweetPixel = videoUrl.includes('sweetpixel.org');
  
  // Se è un media diretto di SweetPixel, proviamo a usarlo senza proxy per risparmiare banda
  const finalVideoUrl = (isDirectMedia && !isSweetPixel)
    ? `/api/video-proxy?url=${encodeURIComponent(videoUrl)}`
    : videoUrl;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header e Numero Episodio Corretto */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href={animeId ? `/anime/${encodeURIComponent(animeId)}` : '/'}
          className="inline-flex items-center gap-2 text-sm font-bold text-neutral-400 hover:text-orange-400 transition"
        >
          ← Torna alla scheda anime
        </Link>

        <span className="text-sm font-black text-orange-500 bg-orange-500/10 px-3.5 py-1 rounded-full border border-orange-500/20">
          Episodio {currentEpDisplay}
        </span>
      </div>

      {/* Player Video */}
      <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-2xl mb-6">
        {loading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

                {isDirectMedia ? (
                  <video
                    ref={videoRef}
                    src={finalVideoUrl}
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                    className="w-full h-full object-contain"
                    {...({ referrerPolicy: 'no-referrer' } as any)}
                  />
                ) : (

                    <iframe
            ref={playerFrameRef}
            onLoad={() => {
              const previous = getContinueWatching().find(
                (item) => item.animeId === animeId && item.episodeId === episodeId
              );
              if (previous && previous.currentTime > 5) {
                playerFrameRef.current?.contentWindow?.postMessage(
                  { type: 'animewall-control', currentTime: previous.currentTime, paused: true },
                  window.location.origin
                );
              }
            }}
            src={finalVideoUrl}
            className="w-full h-full border-0"
            allowFullScreen
            allow="autoplay; encrypted-media; picture-in-picture"
            {...({ referrerPolicy: 'no-referrer' } as any)}
          />

        )}

      </div>

      {/* Controlli di Navigazione Episodi & Selettore Server */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          {prevEp ? (
            <Link
              href={`/watch?anime=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(prevEp.id)}`}
              className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white font-bold px-5 py-3 rounded-2xl transition border border-neutral-700 shadow-lg active:scale-95"
            >
              ← Episodio Precedente ({prevEp.number || 'Prec.'})
            </Link>
          ) : (
            <div />
          )}

          {nextEp && (
            <Link
              href={`/watch?anime=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(nextEp.id)}`}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-black font-extrabold px-6 py-3 rounded-2xl transition shadow-lg shadow-orange-500/20 active:scale-95"
            >
              Episodio Successivo ({nextEp.number || 'Succ.'}) →
            </Link>
          )}
        </div>

        {/* Selettore Server Video */}
        {servers.length > 0 && (
          <div className="bg-[#151822] border border-neutral-800 p-4 rounded-2xl mt-2">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
              Seleziona Server
            </h3>
            <div className="flex flex-wrap gap-2">
              {servers.map((srv) => (
                <button
                  key={srv.id}
                  onClick={() => fetchStream(srv.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-extrabold transition-all ${
                    activeServer === srv.id
                      ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {srv.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {episodesLoading && (
          <section className="rounded-3xl border border-neutral-800 bg-[#0f1117] p-5 text-sm text-neutral-400 sm:p-7">
            Caricamento lista episodi...
          </section>
        )}

        {!episodesLoading && episodesError && (
          <section className="rounded-3xl border border-neutral-800 bg-[#0f1117] p-5 text-sm text-amber-300 sm:p-7">
            {episodesError}
          </section>
        )}

        {!episodesLoading && !episodesError && episodes.length > 0 && (
          <section className="rounded-3xl border border-neutral-800 bg-[#0f1117] p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-orange-500">AnimeWall</p>
                <h2 className="mt-1 text-xl font-black text-white">Tutti gli episodi</h2>
              </div>
              <span className="rounded-full border border-neutral-700 bg-[#151822] px-3 py-1 text-xs font-bold text-neutral-400">
                {episodes.length} episodi
              </span>
            </div>
            <div className="grid max-h-[420px] grid-cols-3 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9">
              {episodes.map((episode, index) => {
                const isCurrent = String(episode.id) === String(episodeId);
                return (
                  <Link
                    key={`${episode.id}-${index}`}
                    href={`/watch?anime=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episode.id)}`}
                    aria-current={isCurrent ? 'true' : undefined}
                    className={`rounded-xl border px-2 py-3 text-center text-sm font-black transition ${isCurrent
                      ? 'border-orange-500 bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                      : 'border-neutral-800 bg-[#151822] text-neutral-300 hover:border-orange-500/60 hover:text-orange-400'}`}
                  >
                    Ep. {episode.number || index + 1}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
'use client';



import { FormEvent, useEffect, useRef, useState } from 'react';

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';



export type RoomRole = 'host' | 'guest';



export interface RoomMedia {
  animeId: string;
  title: string;
  episodeId: string;
  episodeNumber: string;
  episodeVersion?: 'SUB' | 'DUB' | null;
}




interface AnimeEpisode {
  id: string;
  number: string;
  title?: string;
  name?: string;
  label?: string;
  type?: string;
  version?: string;
  language?: string;
  audio?: string;
  audioLanguage?: string;
  dub?: boolean | string;
  sub?: boolean | string;
}

type EpisodeVersion = 'SUB' | 'DUB';

function detectVersion(value: unknown): EpisodeVersion | null {
  if (!value || typeof value !== 'object') return null;

  const data = value as Record<string, unknown>;

  if (data.dub === true || data.isDub === true) return 'DUB';
  if (data.sub === true || data.isSub === true) return 'SUB';

  const fields = [
    data.title,
    data.name,
    data.label,
    data.type,
    data.version,
    data.language,
    data.audio,
    data.audioLanguage,
    typeof data.dub === 'string' ? data.dub : '',
    typeof data.sub === 'string' ? data.sub : '',
    typeof data.id === 'string' ? data.id : '',
  ]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .join(' ')
    .toLowerCase();

  if (/\bdub(?:bed)?(?:ita)?\b/.test(fields)) return 'DUB';
  if (/\bsub(?:bed)?(?:ita)?\b/.test(fields)) return 'SUB';

  return null;
}

function detectEpisodeVersion(episode: AnimeEpisode): EpisodeVersion | null {
  return detectVersion(episode);
}

function episodeLabel(episode: AnimeEpisode, fallbackIndex?: number): string {
  const number = episode.number || String((fallbackIndex ?? 0) + 1);
  const version = detectEpisodeVersion(episode);
  return `Episodio ${number}${version ? ` · ${version}` : ''}`;
}

function getAvailableVersions(episodes: AnimeEpisode[]): EpisodeVersion[] {
  const versions = new Set<EpisodeVersion>();

  episodes.forEach((episode) => {
    const version = detectEpisodeVersion(episode);
    if (version) versions.add(version);
  });

  const allVersions: EpisodeVersion[] = ['SUB', 'DUB'];
  return allVersions.filter((version) => versions.has(version));
}

interface AnimeSearchResult {
  id: string;
  title: string;
  cover?: string;
  name?: string;
  label?: string;
  type?: string;
  version?: string;
  language?: string;
  audio?: string;
  dub?: boolean | string;
  sub?: boolean | string;
  isDub?: boolean;
  isSub?: boolean;
}



interface ChatMessage {

  id: string;

  name: string;

  text: string;

  sentAt: number;

}



interface PlaybackUpdate {

  currentTime: number;

  paused: boolean;

}



interface RoomParticipant {

  id: string;

  name: string;

  role: RoomRole;

}



interface Props {

  code: string;

  name: string;

  role: RoomRole;

  initialMedia?: RoomMedia;

  onExit: () => void;

}



function sendRoomEvent(channel: RealtimeChannel | null, event: string, payload: unknown) {

  if (!channel) return;

  void channel.send({ type: 'broadcast', event, payload });

}



export default function WatchTogetherRoom({ code, name, role, initialMedia, onExit }: Props) {

  const [media, setMedia] = useState<RoomMedia | null>(initialMedia || null);

  const [connected, setConnected] = useState(false);

  const [participants, setParticipants] = useState<RoomParticipant[]>([]);

  const [roomEnded, setRoomEnded] = useState(false);

  const [stopped, setStopped] = useState(false);


  const [streamLoading, setStreamLoading] = useState(false);

  const [streamError, setStreamError] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [chatInput, setChatInput] = useState('');

  const [hostEpisodes, setHostEpisodes] = useState<AnimeEpisode[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [searchResults, setSearchResults] = useState<AnimeSearchResult[]>([]);

  const [searchBusy, setSearchBusy] = useState(false);

  const [nextAnime, setNextAnime] = useState<{ id: string; title: string; episodes: AnimeEpisode[] } | null>(null);

  const [nextEpisodeId, setNextEpisodeId] = useState('');

  const [copied, setCopied] = useState(false);

  const [guestVolume, setGuestVolume] = useState(1);

  const [guestControlsVisible, setGuestControlsVisible] = useState(true);

  const channelRef = useRef<RealtimeChannel | null>(null);

  const playerFrameRef = useRef<HTMLIFrameElement>(null);

  const playerShellRef = useRef<HTMLDivElement>(null);

  const guestControlsTimerRef = useRef<number | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const mediaRef = useRef(media);

  const playbackRef = useRef<PlaybackUpdate>({ currentTime: 0, paused: true });



  mediaRef.current = media;



  useEffect(() => {

    const client = supabase;

    if (!client) return;



    const channel = client.channel(`watch-room:${code}`, {

      config: {

        broadcast: { self: false },

        presence: { key: `${role}-${window.crypto.randomUUID()}` }

      }

    });

    channelRef.current = channel;



    channel

      .on('broadcast', { event: 'media' }, ({ payload }) => {

        const nextMedia = (payload as { media?: RoomMedia }).media;

        if (nextMedia?.animeId && nextMedia.episodeId) {

          setMedia(nextMedia);

          setStopped(false);

          playbackRef.current = { currentTime: 0, paused: true };

        }

      })

      .on('broadcast', { event: 'sync-request' }, () => {

        const currentMedia = mediaRef.current;

        if (role === 'host' && currentMedia) {

          sendRoomEvent(channelRef.current, 'media', { media: currentMedia });

          sendRoomEvent(channelRef.current, 'playback', playbackRef.current);

        }

      })

      .on('broadcast', { event: 'chat' }, ({ payload }) => {

        const message = (payload as { message?: ChatMessage }).message;

        if (message?.text) setChatMessages((current) => [...current.slice(-79), message]);

      })

      .on('broadcast', { event: 'room-ended' }, () => setRoomEnded(true))

      .on('broadcast', { event: 'stop' }, ({ payload }) => {

        if (role !== 'guest') return;

        const update = payload as PlaybackUpdate;

        playbackRef.current = update;

        setStopped(true);

        playerFrameRef.current?.contentWindow?.postMessage(
          { type: 'animewall-control', ...update },
          window.location.origin
        );

      })

      .on('broadcast', { event: 'playback' }, ({ payload }) => {

        if (role !== 'guest') return;

        const update = payload as PlaybackUpdate;

        if (typeof update.currentTime !== 'number' || typeof update.paused !== 'boolean') return;

        playbackRef.current = update;

        setStopped(update.paused);

        playerFrameRef.current?.contentWindow?.postMessage(
          { type: 'animewall-control', ...update },
          window.location.origin
        );

      })

      .on('presence', { event: 'sync' }, () => {

        const presenceState = channel.presenceState();

        const connectedParticipants = Object.entries(presenceState).flatMap(([key, metas]) =>

          metas.map((meta, index) => {

            const participant = meta as { name?: string; role?: RoomRole; presence_ref?: string };

            return {

              id: `${key}-${participant.presence_ref || index}`,

              name: participant.name || 'Guest',

              role: participant.role === 'host' ? 'host' as const : 'guest' as const

            };

          })

        );

        setParticipants(connectedParticipants.sort((a, b) => Number(b.role === 'host') - Number(a.role === 'host')));

      })

      .subscribe((status) => {

        if (status === 'SUBSCRIBED') {

          setConnected(true);

          void channel.track({ name, role, joinedAt: Date.now() });

          if (role === 'guest') sendRoomEvent(channelRef.current, 'sync-request', { name });

        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {

          setConnected(false);

          setParticipants([]);

        }

      });



    return () => {

      channelRef.current = null;

      void channel.unsubscribe();

    };

  }, [code, name, role]);



  useEffect(() => {

    if (role === 'host' && connected && media) {

      sendRoomEvent(channelRef.current, 'media', { media });

    }

  }, [connected, media, role]);



  useEffect(() => {
    if (!media) {
      setStreamLoading(false);
      setStreamError('');
      return;
    }

    setStreamLoading(true);
    setStreamError('');

    return () => {
      setStreamLoading(false);
    };
  }, [media?.animeId, media?.episodeId]);


  useEffect(() => {

    if (role !== 'host' || !media?.animeId) return;

    let cancelled = false;

    fetch(`/api/anime/${encodeURIComponent(media.animeId)}`)

      .then((response) => response.json())

      .then((data) => {

        if (!cancelled) setHostEpisodes(data.anime?.episodes || data.data?.episodes || []);

      })

      .catch((error) => console.error('Errore recuperando episodi stanza:', error));

    return () => { cancelled = true; };

  }, [media?.animeId, role]);



  useEffect(() => {
    if (role !== 'host') return;

    const handlePlayerMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== playerFrameRef.current?.contentWindow) return;

      const data = event.data as { type?: string; currentTime?: number; paused?: boolean };

      if (data.type !== 'animewall-playback' || typeof data.currentTime !== 'number' || typeof data.paused !== 'boolean') return;

      const update = { currentTime: data.currentTime, paused: data.paused };
      playbackRef.current = update;
      setStopped(data.paused);
      sendRoomEvent(channelRef.current, 'playback', update);
    };

    window.addEventListener('message', handlePlayerMessage);
    return () => window.removeEventListener('message', handlePlayerMessage);
  }, [role]);


  useEffect(() => {
    if (role !== 'guest' || !media) return;

    const timeoutId = window.setTimeout(() => {
      playerFrameRef.current?.contentWindow?.postMessage(
        { type: 'animewall-volume', volume: guestVolume },
        window.location.origin
      );
    }, 150);

    return () => window.clearTimeout(timeoutId);
  }, [guestVolume, role, media?.animeId, media?.episodeId]);



  useEffect(() => {

    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === playerShellRef.current);

    document.addEventListener('fullscreenchange', updateFullscreen);

    return () => document.removeEventListener('fullscreenchange', updateFullscreen);

  }, []);



  useEffect(() => {

    const playerShell = playerShellRef.current;

    if (!playerShell || role !== 'guest' || !isFullscreen) {

      setGuestControlsVisible(true);

      if (guestControlsTimerRef.current) window.clearTimeout(guestControlsTimerRef.current);

      guestControlsTimerRef.current = null;

      return;

    }



    const hideControls = () => setGuestControlsVisible(false);

    const revealControls = () => {

      setGuestControlsVisible(true);

      if (guestControlsTimerRef.current) window.clearTimeout(guestControlsTimerRef.current);

      guestControlsTimerRef.current = window.setTimeout(hideControls, 2200);

    };



    revealControls();

    playerShell.addEventListener('pointermove', revealControls);

    playerShell.addEventListener('pointerdown', revealControls);

    playerShell.addEventListener('touchstart', revealControls, { passive: true });



    return () => {

      playerShell.removeEventListener('pointermove', revealControls);

      playerShell.removeEventListener('pointerdown', revealControls);

      playerShell.removeEventListener('touchstart', revealControls);

      if (guestControlsTimerRef.current) window.clearTimeout(guestControlsTimerRef.current);

      guestControlsTimerRef.current = null;

    };

  }, [isFullscreen, role]);



  const searchForAnime = async (event: FormEvent) => {

    event.preventDefault();

    if (!searchQuery.trim()) return;

    setSearchBusy(true);

    try {

      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);

      const data = await response.json();

      setSearchResults(data.results || []);

    } catch {

      setSearchResults([]);

    } finally {

      setSearchBusy(false);

    }

  };



  const pickNextAnime = async (result: AnimeSearchResult) => {

    try {

      const response = await fetch(`/api/anime/${encodeURIComponent(result.id)}`);

      const data = await response.json();

      const anime = data.anime || data.data;

      const episodes: AnimeEpisode[] = anime?.episodes || [];

      setNextAnime({ id: result.id, title: anime?.title || result.title, episodes });

      setNextEpisodeId(episodes[0]?.id || '');

      setSearchResults([]);

      setSearchQuery(result.title);

    } catch {

      setNextAnime(null);

    }

  };



  const changeEpisode = (episodeId: string) => {

    if (role !== 'host' || !media) return;

    const episode = hostEpisodes.find((item) => item.id === episodeId);

    if (!episode) return;

    setMedia({
      ...media,
      episodeId,
      episodeNumber: episode.number,
      episodeVersion: detectEpisodeVersion(episode)
    });

    playbackRef.current = { currentTime: 0, paused: true };

    setStopped(false);

  };



  const changeAnime = () => {

    if (role !== 'host' || !nextAnime || !nextEpisodeId) return;

    const episode = nextAnime.episodes.find((item) => item.id === nextEpisodeId);

    if (!episode) return;

    setMedia({

      animeId: nextAnime.id,

      title: nextAnime.title,

      episodeId: episode.id,

      episodeNumber: episode.number,
      episodeVersion: detectEpisodeVersion(episode)

    });

    setNextAnime(null);

    setSearchOpen(false);

    playbackRef.current = { currentTime: 0, paused: true };

    setStopped(false);

  };



  const sendChatMessage = (event: FormEvent) => {

    event.preventDefault();

    const text = chatInput.trim();

    if (!text || !connected) return;

    const message: ChatMessage = {

      id: window.crypto.randomUUID(),

      name,

      text: text.slice(0, 500),

      sentAt: Date.now()

    };

    setChatMessages((current) => [...current.slice(-79), message]);

    sendRoomEvent(channelRef.current, 'chat', { message });

    setChatInput('');

  };



  const stopPlayback = () => {

    const update = { ...playbackRef.current, paused: true };

    playbackRef.current = update;

    setStopped(true);

    playerFrameRef.current?.contentWindow?.postMessage(
      { type: 'animewall-control', ...update },
      window.location.origin
    );

    sendRoomEvent(channelRef.current, 'stop', update);

  };



  const closeRoom = () => {

    sendRoomEvent(channelRef.current, 'room-ended', { by: name });

    setRoomEnded(true);

  };



  const copyRoomCode = async () => {

    await navigator.clipboard.writeText(code);

    setCopied(true);

    window.setTimeout(() => setCopied(false), 1800);

  };



  const toggleFullscreen = () => {

    if (document.fullscreenElement) {

      void document.exitFullscreen();

    } else {

      void playerShellRef.current?.requestFullscreen();

    }

  };



  if (roomEnded) {

    return (

      <main className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center gap-4 px-4 text-center">

        <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">Watch Together</p>

        <h1 className="text-3xl font-black text-white">Stanza terminata</h1>

        <p className="text-sm text-neutral-400">L’host ha chiuso la sessione o sei uscito dalla stanza.</p>

        <button onClick={onExit} className="rounded-xl bg-orange-500 px-5 py-3 font-black text-black hover:bg-orange-600">Torna a Watch Together</button>

      </main>

    );

  }



  // Watch Together usa sempre il player-proxy come documento dell'iframe.
  // Non mettiamo mai il file .mp4 direttamente come src dell'iframe: alcuni
  // server lo servono con Content-Disposition: attachment e il browser lo scarica.
 const playerUrl = media
  ? `/api/player-proxy?id=${encodeURIComponent(media.episodeId)}&v=3`
  : '';



  return (

    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-[#0f1117] p-4">

        <div className="min-w-0">

          <p className="text-xs font-black uppercase tracking-wider text-orange-500">{role === 'host' ? 'Host della stanza' : 'Guest della stanza'}</p>

          <h1 className="mt-1 truncate text-lg font-black text-white">Ciao, {name}</h1>

        </div>

        <div className="flex flex-wrap items-center gap-2">

          <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-300'}`}>

            {connected ? 'Connesso' : 'Connessione...'}

          </span>

          <button onClick={copyRoomCode} className="rounded-xl border border-neutral-700 bg-[#151822] px-3 py-2 text-xs font-black text-white hover:border-orange-500">

            Codice {code} · {copied ? 'Copiato' : 'Copia'}

          </button>

          {role === 'guest' ? (

            <button onClick={onExit} className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 hover:border-red-500 hover:text-red-300">Esci</button>

          ) : (

            <button onClick={closeRoom} className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10">Chiudi stanza</button>

          )}

        </div>

      </header>



      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">

        <section className="min-w-0">

          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">

            <div>

              <h2 className="text-xl font-black text-white">{media?.title || 'In attesa dell’host'}</h2>

              {media && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-neutral-400">Episodio {media.episodeNumber}</p>
                  {media.episodeVersion && (
                    <span className="rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black tracking-[0.12em] text-orange-300">
                      {media.episodeVersion}
                    </span>
                  )}
                </div>
              )}

            </div>

            {role === 'host' && media && (

              <div className="flex flex-wrap items-center gap-2">

                {hostEpisodes.length > 0 && (

                  <select value={media.episodeId} onChange={(event) => changeEpisode(event.target.value)} className="max-w-48 rounded-xl border border-neutral-800 bg-[#151822] px-3 py-2 text-sm text-white outline-none focus:border-orange-500">

                    {hostEpisodes.map((episode, index) => (
                      <option key={episode.id} value={episode.id}>
                        {episodeLabel(episode, index)}
                      </option>
                    ))}

                  </select>

                )}

                <button onClick={() => setSearchOpen((open) => !open)} className="rounded-xl border border-neutral-700 px-3 py-2 text-sm font-bold text-neutral-200 hover:border-orange-500">Cambia anime</button>

                <button onClick={stopPlayback} disabled={stopped} className="rounded-xl bg-red-500/15 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/25 disabled:opacity-40">Ferma</button>

              </div>

            )}

          </div>



          {role === 'host' && searchOpen && (

            <div className="mb-4 rounded-2xl border border-neutral-800 bg-[#0f1117] p-4">

              <form onSubmit={searchForAnime} className="flex gap-2">

                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca un altro anime..." className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-[#151822] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500" />

                <button disabled={searchBusy} className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-black text-black disabled:opacity-50">Cerca</button>

              </form>

              {searchResults.length > 0 && (

                <div className="mt-3 grid max-h-48 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">

                  {searchResults.slice(0, 8).map((result) => (
                    <button
                      key={result.id}
                      onClick={() => pickNextAnime(result)}
                      className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-[#151822] px-3 py-2 text-left text-sm font-semibold text-neutral-200 hover:border-orange-500"
                    >
                      <span className="min-w-0 flex-1 truncate">{result.title}</span>
                      {detectVersion(result) && (
                        <span className="shrink-0 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black tracking-[0.12em] text-orange-300">
                          {detectVersion(result)}
                        </span>
                      )}
                    </button>
                  ))}

                </div>

              )}

              {nextAnime && (

                <>
                  {getAvailableVersions(nextAnime.episodes).length > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                      <span className="font-bold">Versioni disponibili:</span>
                      {getAvailableVersions(nextAnime.episodes).map((version) => (
                        <span key={version} className="rounded-md border border-neutral-700 bg-[#151822] px-2 py-1 text-[10px] font-black tracking-[0.12em] text-neutral-300">
                          {version}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">

                  <select value={nextEpisodeId} onChange={(event) => setNextEpisodeId(event.target.value)} className="min-w-40 flex-1 rounded-xl border border-neutral-800 bg-[#151822] px-3 py-2 text-sm text-white">

                    {nextAnime.episodes.map((episode, index) => (
                      <option key={episode.id} value={episode.id}>
                        {episodeLabel(episode, index)}
                      </option>
                    ))}

                  </select>

                  <button onClick={changeAnime} disabled={!nextEpisodeId} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-black disabled:opacity-40">Condividi episodio</button>

                  </div>
                </>

              )}

            </div>

          )}



          <div ref={playerShellRef} className={`relative aspect-video overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-2xl ${role === 'guest' && isFullscreen && !guestControlsVisible ? 'cursor-none' : ''}`}>

            {streamLoading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 text-sm font-bold text-orange-400">Caricamento player...</div>}

            {!media && <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-neutral-400">Quando l’host avvia un episodio, lo vedrai qui.</div>}

            {streamError && <div className="absolute inset-0 z-20 flex items-center justify-center px-6 text-center text-sm font-bold text-red-300">{streamError}</div>}

            {playerUrl && !streamError && (
              <iframe
                key={`${media?.animeId}-${media?.episodeId}`}
                ref={playerFrameRef}
                src={playerUrl}
                title={`${media?.title || 'Anime'} - episodio ${media?.episodeNumber || ''}`}
                className={`h-full w-full border-0 ${role === 'guest' ? 'pointer-events-none' : ''}`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                onLoad={() => setStreamLoading(false)}
                onError={() => {
                  setStreamLoading(false);
                  setStreamError('Impossibile caricare il player video.');
                }}
              />
            )}
            

            {role === 'guest' && playerUrl && (

              <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2">

                <label className={`flex items-center gap-2 rounded-lg border border-white/20 bg-black/75 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur transition-opacity duration-300 ${isFullscreen && !guestControlsVisible ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'}`}>

                  <span>Volume</span>

                  <input

                    type="range"

                    min="0"

                    max="1"

                    step="0.05"

                    value={guestVolume}

                    onChange={(event) => setGuestVolume(Number(event.target.value))}

                    aria-label="Volume personale"

                    className="w-20 accent-orange-500 sm:w-28"

                  />

                  <span className="w-8 text-right tabular-nums">{Math.round(guestVolume * 100)}%</span>

                </label>

                <button onClick={toggleFullscreen} className={`rounded-lg border border-white/20 bg-black/75 px-3 py-2 text-xs font-black text-white shadow-lg backdrop-blur transition-opacity duration-300 hover:bg-black ${isFullscreen && !guestControlsVisible ? 'pointer-events-none opacity-0' : 'pointer-events-auto opacity-100'}`}>

                  {isFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}

                </button>

              </div>

            )}

            {stopped && media && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/45 text-lg font-black text-white">Riproduzione fermata dall’host</div>}

          </div>



          <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Play Together</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
              La sincronizzazione play/pausa potrebbe non funzionare con alcuni episodi riprodotti direttamente dal server video. In quel caso il video resta visibile, ma i controlli remoti dell’host potrebbero non essere sincronizzati.
            </p>
          </div>

        </section>



        <aside className="flex h-[min(75vh,760px)] min-h-[480px] flex-col rounded-2xl border border-neutral-800 bg-[#0f1117]">

          <section className="border-b border-neutral-800 p-4">

            <div className="mb-3 flex items-center justify-between gap-2">

              <h2 className="font-black text-white">Persone nella stanza</h2>

              <span className="rounded-full bg-[#151822] px-2.5 py-1 text-xs font-bold text-neutral-300">{participants.length}</span>

            </div>

            <ul className="flex flex-col gap-2">

              {participants.map((participant) => (

                <li key={participant.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#151822] px-3 py-2">

                  <span className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold text-neutral-200">

                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />

                    {participant.name}{participant.name === name ? ' (tu)' : ''}

                  </span>

                  <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase ${participant.role === 'host' ? 'bg-orange-500/15 text-orange-400' : 'bg-neutral-700 text-neutral-300'}`}>

                    {participant.role === 'host' ? 'Host' : 'Guest'}

                  </span>

                </li>

              ))}

              {participants.length === 0 && <li className="text-xs text-neutral-500">In attesa dei partecipanti...</li>}

            </ul>

          </section>

          <div className="border-b border-neutral-800 p-4">

            <h2 className="font-black text-white">Chat stanza</h2>

            <p className="mt-1 text-xs text-neutral-500">{connected ? 'Messaggi in tempo reale' : 'In attesa della connessione'}</p>

          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4" aria-live="polite">

            {chatMessages.length === 0 && <p className="py-10 text-center text-sm text-neutral-500">Nessun messaggio. Rompi il ghiaccio.</p>}

            {chatMessages.map((message) => (

              <article key={message.id} className="break-words rounded-xl bg-[#151822] p-3">

                <div className="mb-1 flex items-center justify-between gap-2">

                  <strong className="truncate text-xs text-orange-400">{message.name}</strong>

                  <time className="shrink-0 text-[10px] text-neutral-500">{new Date(message.sentAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</time>

                </div>

                <p className="whitespace-pre-wrap text-sm text-neutral-200">{message.text}</p>

              </article>

            ))}

          </div>

          <form onSubmit={sendChatMessage} className="flex gap-2 border-t border-neutral-800 p-3">

            <input value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={500} placeholder="Scrivi un messaggio..." disabled={!connected} className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-[#151822] px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-orange-500 disabled:opacity-50" />

            <button type="submit" disabled={!connected || !chatInput.trim()} aria-label="Invia messaggio" className="rounded-xl bg-orange-500 px-4 text-sm font-black text-black hover:bg-orange-600 disabled:opacity-40">Invia</button>

          </form>

        </aside>

      </div>

    </main>

  );

}
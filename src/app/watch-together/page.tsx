'use client';



import { FormEvent, useState } from 'react';

import WatchTogetherRoom, { type RoomMedia, type RoomRole } from './room';

import { supabase } from '@/lib/supabase';



interface SearchAnime {
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




interface AnimeData {

  id: string;

  title: string;

  episodes: AnimeEpisode[];

}



interface RoomSession {

  code: string;

  name: string;

  role: RoomRole;

  initialMedia?: RoomMedia;

}



function makeRoomCode() {

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const bytes = new Uint8Array(8);

  window.crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');

}



export default function WatchTogetherPage() {

  const [role, setRole] = useState<RoomRole>('host');

  const [name, setName] = useState('');

  const [roomCode, setRoomCode] = useState('');

  const [animeQuery, setAnimeQuery] = useState('');

  const [searchResults, setSearchResults] = useState<SearchAnime[]>([]);

  const [selectedAnime, setSelectedAnime] = useState<AnimeData | null>(null);

  const [episodeId, setEpisodeId] = useState('');

  const [searching, setSearching] = useState(false);

  const [loadingAnime, setLoadingAnime] = useState(false);

  const [error, setError] = useState('');

  const [session, setSession] = useState<RoomSession | null>(null);



  const searchAnime = async (event: FormEvent) => {

    event.preventDefault();

    if (!animeQuery.trim()) return;

    setSearching(true);

    setError('');

    try {

      const response = await fetch(`/api/search?q=${encodeURIComponent(animeQuery.trim())}`);

      if (!response.ok) throw new Error('Ricerca anime non disponibile.');

      const data = await response.json();

      setSearchResults(data.results || []);

    } catch (searchError) {

      setError(searchError instanceof Error ? searchError.message : 'Errore durante la ricerca.');

      setSearchResults([]);

    } finally {

      setSearching(false);

    }

  };



  const selectAnime = async (result: SearchAnime) => {

    setLoadingAnime(true);

    setError('');

    try {

      const response = await fetch(`/api/anime/${encodeURIComponent(result.id)}`);

      if (!response.ok) throw new Error('Impossibile caricare gli episodi di questo anime.');

      const data = await response.json();

      const anime = (data.anime || data.data) as AnimeData;

      setSelectedAnime(anime);

      setEpisodeId(anime.episodes?.[0]?.id || '');

      setSearchResults([]);

      setAnimeQuery(anime.title || result.title);

    } catch (animeError) {

      setError(animeError instanceof Error ? animeError.message : 'Errore caricando l’anime.');

    } finally {

      setLoadingAnime(false);

    }

  };



  const hostRoom = () => {

    if (!name.trim() || !selectedAnime || !episodeId) return;

    const episode = selectedAnime.episodes.find((item) => item.id === episodeId);

    if (!episode) return;

    setSession({

      code: makeRoomCode(),

      name: name.trim(),

      role: 'host',

      initialMedia: {

        animeId: selectedAnime.id,

        title: selectedAnime.title,

        episodeId: episode.id,

        episodeNumber: episode.number,
          episodeVersion: detectEpisodeVersion(episode)

      }

    });

  };



  const joinRoom = (event: FormEvent) => {

    event.preventDefault();

    const code = roomCode.trim().toUpperCase();

    if (!name.trim() || code.length < 6) return;

    setSession({ code, name: name.trim(), role: 'guest' });

  };



  if (session) {

    return (

      <WatchTogetherRoom

        key={session.code}

        {...session}

        onExit={() => setSession(null)}

      />

    );

  }



  return (

    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">

      <header className="flex flex-col gap-2">

        <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-500">AnimeWall / Insieme</p>

        <h1 className="text-3xl font-black text-white sm:text-4xl">Watch Together</h1>

        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">

          Crea una stanza o entra con un codice. L’host sceglie cosa guardare; gli altri seguono i cambi di episodio e possono chattare.

        </p>

      </header>



      {!supabase && (

        <aside className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-100">

          <strong className="block text-amber-300">Configura Supabase Realtime</strong>

          Aggiungi <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> nel file <code>.env.local</code> e nelle variabili d’ambiente del tuo hosting per abilitare le stanze.

        </aside>

      )}



      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">

        <div className="rounded-3xl border border-neutral-800 bg-[#0f1117] p-5 sm:p-7">

          <div className="mb-6 flex w-fit gap-1 rounded-xl border border-neutral-800 bg-[#151822] p-1">

            {(['host', 'guest'] as const).map((option) => (

              <button

                key={option}

                type="button"

                onClick={() => { setRole(option); setError(''); }}

                className={`rounded-lg px-4 py-2 text-sm font-black transition ${role === option ? 'bg-orange-500 text-black' : 'text-neutral-400 hover:text-white'}`}

              >

                {option === 'host' ? 'Hosta' : 'Joina'}

              </button>

            ))}

          </div>



          {role === 'host' ? (

            <div className="flex flex-col gap-5">

              <label className="flex flex-col gap-2 text-sm font-bold text-neutral-300">

                Il tuo nome

                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Come ti chiamano in stanza?" className="rounded-xl border border-neutral-800 bg-[#151822] px-4 py-3 text-white outline-none placeholder:text-neutral-500 focus:border-orange-500" />

              </label>



              <form onSubmit={searchAnime} className="flex flex-col gap-2">

                <label htmlFor="room-anime-search" className="text-sm font-bold text-neutral-300">Scegli un anime</label>

                <div className="flex gap-2">

                  <input id="room-anime-search" value={animeQuery} onChange={(event) => setAnimeQuery(event.target.value)} placeholder="Cerca il titolo..." className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-[#151822] px-4 py-3 text-white outline-none placeholder:text-neutral-500 focus:border-orange-500" />

                  <button type="submit" disabled={searching || !animeQuery.trim()} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-black transition hover:bg-orange-600 disabled:opacity-50">{searching ? '...' : 'Cerca'}</button>

                </div>

              </form>



              {searchResults.length > 0 && (

                <div className="max-h-64 overflow-y-auto rounded-xl border border-neutral-800 bg-[#151822]">

                  {searchResults.slice(0, 10).map((result) => (

                    <button key={result.id} type="button" onClick={() => selectAnime(result)} className="flex w-full items-center gap-3 border-b border-neutral-800 p-3 text-left last:border-0 hover:bg-[#1a1e2a]">

                      {result.cover && <img src={result.cover} alt="" className="h-14 w-10 rounded object-cover" />}

                      <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className="min-w-0 truncate text-sm font-bold text-neutral-200">{result.title}</span>
                          {detectVersion(result) && (
                            <span className="shrink-0 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-black tracking-[0.12em] text-orange-300">
                              {detectVersion(result)}
                            </span>
                          )}
                        </span>

                    </button>

                  ))}

                </div>

              )}



              {loadingAnime && <p className="text-sm text-neutral-400">Caricamento episodi...</p>}

              {selectedAnime && !loadingAnime && (

                <>
                  {getAvailableVersions(selectedAnime.episodes).length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <span className="font-bold">Versioni disponibili:</span>
                      {getAvailableVersions(selectedAnime.episodes).map((version) => (
                        <span key={version} className="rounded-md border border-neutral-700 bg-[#151822] px-2 py-1 text-[10px] font-black tracking-[0.12em] text-neutral-300">
                          {version}
                        </span>
                      ))}
                    </div>
                  )}

                  <label className="flex flex-col gap-2 text-sm font-bold text-neutral-300">

                  Episodio iniziale

                  <select value={episodeId} onChange={(event) => setEpisodeId(event.target.value)} className="rounded-xl border border-neutral-800 bg-[#151822] px-4 py-3 text-white outline-none focus:border-orange-500">

                    {selectedAnime.episodes.map((episode, index) => (
                        <option key={episode.id} value={episode.id}>
                          {episodeLabel(episode, index)}
                        </option>
                      ))}

                  </select>

                  </label>
                </>

              )}



              {error && <p role="alert" className="text-sm font-semibold text-red-400">{error}</p>}

              <button type="button" onClick={hostRoom} disabled={!supabase || !name.trim() || !selectedAnime || !episodeId} className="mt-1 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-black text-black transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40">

                Crea stanza e avvia

              </button>

            </div>

          ) : (

            <form onSubmit={joinRoom} className="flex flex-col gap-5">

              <label className="flex flex-col gap-2 text-sm font-bold text-neutral-300">

                Il tuo nome

                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Come ti chiamano in stanza?" className="rounded-xl border border-neutral-800 bg-[#151822] px-4 py-3 text-white outline-none placeholder:text-neutral-500 focus:border-orange-500" />

              </label>

              <label className="flex flex-col gap-2 text-sm font-bold text-neutral-300">

                Codice stanza

                <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 12))} maxLength={12} placeholder="Es. 8KQ2M7XP" className="rounded-xl border border-neutral-800 bg-[#151822] px-4 py-3 font-mono uppercase tracking-[0.15em] text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-neutral-500 focus:border-orange-500" />

              </label>

              <button type="submit" disabled={!supabase || !name.trim() || roomCode.trim().length < 6} className="rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-black text-black transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40">

                Entra nella stanza

              </button>

            </form>

          )}

        </div>



        <aside className="rounded-3xl border border-neutral-800 bg-[#151822] p-5 sm:p-7">

          <h2 className="text-lg font-black text-white">Come funziona</h2>

          <ol className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-neutral-400">

            <li><span className="mr-2 font-black text-orange-500">01</span>L’host sceglie l’anime e condivide il codice.</li>

            <li><span className="mr-2 font-black text-orange-500">02</span>I guest inseriscono nome e codice per entrare.</li>

            <li><span className="mr-2 font-black text-orange-500">03</span>I cambi di anime o episodio e la chat sono condivisi in tempo reale.</li>

            <li><span className="mr-2 font-black text-orange-500">04</span>Solo l’host può fermare o chiudere la stanza.</li>

          </ol>

          <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Attenzione Play Together</p>
            <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
              Con alcuni episodi il video viene riprodotto direttamente dal server sorgente. In questi casi la sincronizzazione play/pausa potrebbe non funzionare, anche se il video continua a essere riprodotto normalmente.
            </p>
          </div>

        </aside>

      </section>

    </main>

  );

}
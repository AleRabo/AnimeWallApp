export async function searchAnime(query: string) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const serverMessage = errorData.error ? errorData.error : `Errore HTTP ${res.status}`;
      throw new Error(`Errore Backend (${res.status}): ${serverMessage}`);
    }
    return res.json();
  } catch (err) {
    console.error('Dettaglio errore searchAnime:', err);
    throw err;
  }
}

export async function getAnimeDetails(id: string) {
  try {
    // ✅ CORRETTO: Chiamata alle API route di Next.js, stesso dominio del sito
    const res = await fetch(`/api/anime/${id}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const serverMessage = errorData.error ? errorData.error : `Errore HTTP ${res.status}`;
      throw new Error(`Errore Backend (${res.status}): ${serverMessage}`);
    }
    return res.json();
  } catch (err) {
    console.error('Dettaglio errore getAnimeDetails:', err);
    throw err;
  }
}

export async function getEpisodeStream(animeId: string, episodeId: string, serverId?: string) {
  const url = serverId
    ? `/api/episode/${animeId}/${episodeId}?server=${encodeURIComponent(serverId)}`
    : `/api/episode/${animeId}/${episodeId}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Errore durante il recupero dello streaming');
  }
  return res.json();
}

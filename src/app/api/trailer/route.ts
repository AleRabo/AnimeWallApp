export const revalidate = 3600;

export async function GET(request: Request) {
  const title = new URL(request.url).searchParams.get('title')?.trim();
  if (!title) return Response.json({ trailerUrl: null });

  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1&sfw=true`,
      { headers: { Accept: 'application/json' } }
    );
    if (!response.ok) return Response.json({ trailerUrl: null });

    const payload = await response.json() as {
      data?: Array<{ trailer?: { embed_url?: string | null; youtube_id?: string | null } }>;
    };
    const trailer = payload.data?.[0]?.trailer;
    const trailerUrl = trailer?.embed_url
      || (trailer?.youtube_id ? `https://www.youtube.com/embed/${trailer.youtube_id}` : null);

    return Response.json({ trailerUrl: trailerUrl || null });
  } catch (error) {
    console.error('Errore recuperando il trailer:', error);
    return Response.json({ trailerUrl: null });
  }
}

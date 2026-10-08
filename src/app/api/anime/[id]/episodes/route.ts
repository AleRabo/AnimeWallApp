import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return Response.json({ error: 'ID Anime mancante.', episodes: [] }, { status: 400 });

    const episodes = await AnimeWallService.getAnimeEpisodes(id);
    return Response.json({ success: true, count: episodes.length, episodes });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ error: errorMessage, episodes: [] }, { status: 500 });
  }
}
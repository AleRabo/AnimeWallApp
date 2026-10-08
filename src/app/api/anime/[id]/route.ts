import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return Response.json({ error: 'ID Anime mancante.' }, { status: 400 });

    const details = await AnimeWallService.getAnimeDetails(id);
    return Response.json({ success: true, anime: details });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

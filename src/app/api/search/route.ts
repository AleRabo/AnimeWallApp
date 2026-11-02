import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const query = new URL(req.url).searchParams.get('q') ?? '';
    if (!query) {
      return Response.json({ error: 'Parametro "q" mancante o non valido.' }, { status: 400 });
    }

    const results = await AnimeWallService.searchAnime(query);
    return Response.json(
      { success: true, count: results.length, results },
      { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

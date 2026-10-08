import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const requestedPage = Number(new URL(req.url).searchParams.get('page') || '1');
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  try {
    const sourcePage = Math.ceil(page / 2);
    const sourceResults = await AnimeWallService.getTopAnime(sourcePage);
    const pageOffset = ((page - 1) % 2) * 25;
    const anime = sourceResults.slice(pageOffset, pageOffset + 25);
    return Response.json(
      { success: true, page, count: anime.length, hasNext: sourceResults.length === 50, anime },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ success: false, error: errorMessage, anime: [] }, { status: 500 });
  }
}
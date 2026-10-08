import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const year = Number(params.get('year') || new Date().getFullYear());
  const season = params.get('season') || 'fall';

  if (!Number.isInteger(year) || !/^(winter|spring|summer|fall)$/.test(season)) {
    return Response.json({ success: false, error: 'Stagione non valida.', anime: [] }, { status: 400 });
  }

  try {
    const anime = await AnimeWallService.getUpcomingAnime(year, season);
    return Response.json(
      { success: true, year, season, count: anime.length, anime },
      { headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ success: false, error: errorMessage, anime: [] }, { status: 500 });
  }
}
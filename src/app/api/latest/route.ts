import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const episodes = await AnimeWallService.getLatestEpisodes();
    return Response.json(
      { success: true, count: episodes.length, episodes },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno';
    return Response.json({ success: false, error: errorMessage, episodes: [] }, { status: 500 });
  }
}

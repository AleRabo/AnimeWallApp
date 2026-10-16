import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const featured = await AnimeWallService.getFeaturedAnime();
    return Response.json(
      { success: true, featured },
      { headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' } }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno';
    return Response.json({ success: false, error: errorMessage, featured: [] }, { status: 500 });
  }
}

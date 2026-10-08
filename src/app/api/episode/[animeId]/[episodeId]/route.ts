import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ animeId: string; episodeId: string }> }
) {
  try {
    const { animeId, episodeId } = await params;

    if (!animeId || !episodeId) {
      return Response.json({ error: 'Parametri animeId ed episodeId obbligatori.' }, { status: 400 });
    }

    const serverId = new URL(req.url).searchParams.get('server') ?? undefined;

    const stream = await AnimeWallService.getEpisodeStream(animeId, episodeId, serverId);
    return Response.json({ success: true, stream });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}

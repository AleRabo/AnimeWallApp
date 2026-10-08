import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const calendar = await AnimeWallService.getCalendar();
    return Response.json({ success: true, calendar });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ success: false, error: errorMessage, calendar: [] }, { status: 500 });
  }
}
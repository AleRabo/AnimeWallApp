import { AnimeWallService } from '@/services/animeworld.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const week = new URL(req.url).searchParams.get('week') || undefined;
    if (week && !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
      return Response.json({ success: false, error: 'Settimana non valida.', calendar: [] }, { status: 400 });
    }
    const calendar = await AnimeWallService.getCalendar(week);
    return Response.json({ success: true, calendar });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore interno del server';
    return Response.json({ success: false, error: errorMessage, calendar: [] }, { status: 500 });
  }
}
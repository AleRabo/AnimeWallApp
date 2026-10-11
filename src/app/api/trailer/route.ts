import axios from 'axios';
import * as cheerio from 'cheerio';

export const revalidate = 3600;

export async function GET(request: Request) {
  const animeId = new URL(request.url).searchParams.get('animeId')?.trim();
  if (!animeId) return Response.json({ trailerUrl: null });

  try {
    const response = await axios.get(
      `https://www.animeworld.ac/play/${encodeURIComponent(animeId)}`,
      {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    const $ = cheerio.load(response.data);
    const trailerUrl = $('.trailer[data-url]').first().attr('data-url')?.trim() || null;

    return Response.json({ trailerUrl });
  } catch (error) {
    console.error('Errore recuperando il trailer:', error);
    return Response.json({ trailerUrl: null });
  }
}

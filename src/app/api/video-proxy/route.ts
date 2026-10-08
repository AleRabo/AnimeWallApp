// app/api/video-proxy/route.ts
export const dynamic = 'force-dynamic';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const REFERER = 'https://www.animeworld.ac/';

function isAllowedVideoTarget(target: URL): boolean {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return false;

  const host = target.hostname.toLowerCase();
  const isAnimeWorldVideoHost = host === 'sweetpixel.org' || host.endsWith('.sweetpixel.org');
  const isVideoFile = /\.(mp4|m3u8)$/i.test(target.pathname);
  return isAnimeWorldVideoHost && isVideoFile && !target.port;
}

export async function GET(req: Request) {
  const rawUrl = new URL(req.url).searchParams.get('url');
  if (!rawUrl) return Response.json({ error: 'URL video mancante.' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return Response.json({ error: 'URL video non valido.' }, { status: 400 });
  }

  if (!isAllowedVideoTarget(target)) {
    return Response.json(
      { error: 'Il proxy accetta solo stream AnimeWorld MP4/HLS autorizzati.' },
      { status: 403 }
    );
  }

  try {
    const range = req.headers.get('range');
    const upstream = await fetch(target, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: REFERER,
        ...(range ? { Range: range } : {})
      }
    });

    if (!upstream.ok && upstream.status !== 206) {
      return Response.json(
        { error: `Impossibile riprodurre lo stream video (${upstream.status}).` },
        { status: 502 }
      );
    }

    // Forza un Content-Type riproducibile: se il server manda octet-stream
    // o niente, il browser potrebbe trattarlo come download.
    const upstreamType = (upstream.headers.get('content-type') || '').toLowerCase();
    const isHls = /\.m3u8$/i.test(target.pathname);
    const contentType = isHls
      ? 'application/vnd.apple.mpegurl'
      : upstreamType.startsWith('video/')
        ? upstreamType
        : 'video/mp4';

    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600'
    });

    for (const name of ['content-length', 'content-range', 'last-modified', 'etag']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error('❌ Errore proxy video:', error);
    return Response.json({ error: 'Impossibile riprodurre lo stream video.' }, { status: 500 });
  }
}
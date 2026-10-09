// app/api/player-proxy/route.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

export const dynamic = 'force-dynamic';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const ANIMEWORLD_ORIGIN = 'https://www.animeworld.ac';

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const resolveUrl = (value: string, base: string): string => {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
};

const isHls = (url: string): boolean => /\.m3u8(?:$|[?#])/i.test(url);

// Estensione permissiva: ".mp4" anche seguito da "/", "?" o "#".
const hasMediaExtension = (url: string): boolean =>
  /\.(mp4|m4v|webm|m3u8)(?:$|[/?#])/i.test(url);

// Stessa regola dell'allowlist di /api/video-proxy: solo MP4 sweetpixel.
// Gli URL consentiti passano dal proxy (niente Content-Disposition, Range ok).
const proxiedVideoUrl = (src: string): string => {
  try {
    const u = new URL(src);
    const allowed =
      (u.hostname === 'sweetpixel.org' || u.hostname.endsWith('.sweetpixel.org')) &&
      /\.mp4$/i.test(u.pathname) &&
      !u.port;
    return allowed ? `/api/video-proxy?url=${encodeURIComponent(src)}` : src;
  } catch {
    return src;
  }
};

// Se l'URL non ha un'estensione chiara, chiediamo al server cosa serve.
// Range 0-0 perché alcuni server rifiutano HEAD.
const looksLikeMedia = async (url: string): Promise<boolean> => {
  if (hasMediaExtension(url)) return true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${ANIMEWORLD_ORIGIN}/`,
        Range: 'bytes=0-0'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeout);
    void res.body?.cancel();

    const type = (res.headers.get('content-type') || '').toLowerCase();
    const disposition = (res.headers.get('content-disposition') || '').toLowerCase();

    return (
      type.startsWith('video/') ||
      type.includes('mpegurl') ||
      type === 'application/octet-stream' ||
      disposition.includes('attachment')
    );
  } catch {
    return false;
  }
};

const playerBridge = `<script>
(() => {
  let lastUpdate = 0;

  const sendPlayback = (force = false) => {
    const video = document.querySelector('video');
    if (!video) return;

    const now = Date.now();
    if (!force && now - lastUpdate < 1800) return;
    lastUpdate = now;

    window.parent.postMessage(
      {
        type: 'animewall-playback',
        currentTime: video.currentTime,
        paused: video.paused,
        duration: Number.isFinite(video.duration) ? video.duration : 0
      },
      window.location.origin
    );
  };

  window.addEventListener('message', (event) => {
    if (
      event.source !== window.parent ||
      event.origin !== window.location.origin
    ) return;

    const command = event.data;
    if (!command) return;

    const video = document.querySelector('video');

    if (command.type === 'animewall-volume') {
      const volume = Number(command.volume);
      if (!Number.isFinite(volume)) return;

      if (video) {
        video.volume = Math.min(1, Math.max(0, volume));
        video.muted = volume === 0;
        return;
      }

      document.querySelector('iframe')?.contentWindow?.postMessage(command, '*');
      return;
    }

    if (command.type !== 'animewall-control') return;

    if (video) {
      if (
        Number.isFinite(command.currentTime) &&
        Math.abs(video.currentTime - command.currentTime) > 1.5
      ) {
        video.currentTime = command.currentTime;
      }

      if (command.paused) video.pause();
      else void video.play().catch(() => {});
      return;
    }

    document.querySelector('iframe')?.contentWindow?.postMessage(command, '*');
  });

  const attach = () => {
    const video = document.querySelector('video');
    if (!video) return;

    video.addEventListener('timeupdate', () => sendPlayback());
    video.addEventListener('play', () => sendPlayback(true));
    video.addEventListener('pause', () => sendPlayback(true));
    video.addEventListener('loadedmetadata', () => sendPlayback(true));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();
</script>`;

const baseStyles = `
  html,body{width:100%;height:100%;margin:0;padding:0;background:#000;overflow:hidden;}
  body{display:flex;align-items:center;justify-content:center;}
  video{width:100%;height:100%;max-width:100%;max-height:100vh;object-fit:contain;background:#000;}
`;

const mp4Html = (videoSrc: string) => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <style>${baseStyles}</style>
  </head>
  <body>
    <video
      src="${escapeAttr(proxiedVideoUrl(videoSrc))}"
      controls
      autoplay
      playsinline
      preload="auto"
    ></video>
  </body>
</html>`;

// HLS: Chrome/Firefox non lo supportano nativamente -> hls.js.
const hlsHtml = (hlsSrc: string) => `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <style>${baseStyles}</style>
  </head>
  <body>
    <video id="v" controls autoplay playsinline></video>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js"></script>
    <script>
      (function () {
        var video = document.getElementById('v');
        var src = ${JSON.stringify(hlsSrc)};
        if (window.Hls && Hls.isSupported()) {
          var hls = new Hls();
          hls.loadSource(src);
          hls.attachMedia(video);
        } else {
          video.src = src; // Safari
        }
      })();
    </script>
  </body>
</html>`;

const videoHtml = (src: string) => (isHls(src) ? hlsHtml(src) : mp4Html(src));

const iframeHtml = (iframeSrc: string) => `<!DOCTYPE html>
<html style="width:100%;height:100%;margin:0;padding:0;background:#000;">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="referrer" content="no-referrer">
    <style>html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden;background:#000;}</style>
  </head>
  <body>
    <iframe
      src="${escapeAttr(iframeSrc)}"
      width="100%"
      height="100%"
      frameborder="0"
      allowfullscreen
      allow="autoplay; encrypted-media; picture-in-picture"
      referrerpolicy="no-referrer"
      style="border:0;width:100%;height:100%;"
    ></iframe>
  </body>
</html>`;

const htmlResponse = (body: string) => {
  const bodyWithBridge = body.includes('</body>')
    ? body.replace('</body>', `${playerBridge}</body>`)
    : `${body}${playerBridge}`;

  return new Response(bodyWithBridge, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
};

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get('id') ?? '';

  if (!playerId) {
    return new Response('ID Player mancante o non valido.', { status: 400 });
  }

  try {
    const playerUrl =
      `${ANIMEWORLD_ORIGIN}/api/episode/serverPlayerAnimeWorld?id=` +
      encodeURIComponent(playerId);

    const response = await axios.get(playerUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: `${ANIMEWORLD_ORIGIN}/`,
        'X-Requested-With': 'XMLHttpRequest'
      },
      responseType: 'text'
    });

    const rawHtml = response.data;

    if (typeof rawHtml !== 'string') {
      return new Response('Risposta del player non valida.', { status: 500 });
    }

    const $ = cheerio.load(rawHtml);

    // 1) Iframe: se in realtà è un file video NON lo annidiamo (scaricherebbe).
    const iframeSrcRaw = $('iframe').attr('src');

    if (iframeSrcRaw) {
      const iframeSrc = resolveUrl(iframeSrcRaw, ANIMEWORLD_ORIGIN);
      console.log('[player-proxy] iframe src:', iframeSrc);

      if (await looksLikeMedia(iframeSrc)) {
        return htmlResponse(videoHtml(iframeSrc));
      }

      return htmlResponse(iframeHtml(iframeSrc));
    }

    // 2) <video>/<source> diretto.
    const videoSrcRaw = $('video').attr('src') || $('source').attr('src');

    if (videoSrcRaw) {
      const videoSrc = resolveUrl(videoSrcRaw, ANIMEWORLD_ORIGIN);
      console.log('[player-proxy] video src:', videoSrc);
      return htmlResponse(videoHtml(videoSrc));
    }

    // 3) Link diretto a un media dentro l'HTML (<a href>, script, ecc.).
    const mediaMatch = rawHtml.match(/https?:\/\/[^"'\s<>\\]+?\.(?:mp4|m3u8)(?:[^"'\s<>\\]*)/i);

    if (mediaMatch) {
      console.log('[player-proxy] media trovato nell\'HTML:', mediaMatch[0]);
      return htmlResponse(videoHtml(mediaMatch[0]));
    }

    // 4) Fallback per player HTML più complessi.
    const cleanHtml = rawHtml.replace(
      '<head>',
      `<head>
        <meta name="referrer" content="no-referrer">
        <base href="${ANIMEWORLD_ORIGIN}/">`
    );

    return htmlResponse(cleanHtml);
  } catch (error) {
    console.error('❌ Errore Player Proxy:', error);
    return new Response('Impossibile caricare il player video.', { status: 500 });
  }
}
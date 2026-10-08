import axios from 'axios';
import * as cheerio from 'cheerio';

export interface AnimeSearchResult {
  id: string;
  title: string;
  link: string;
  cover: string;
  extraInfo: string;
  isDub: boolean;        // Se è doppiato in ITA
  isSub: boolean;        // Se è in SUB-ITA
}

export interface EpisodeItem {
  id: string;
  number: string;
  link: string;
}

export interface AnimeDetails {
  id: string;
  title: string;
  cover: string;
  plot: string;
  genres: string[];
  status: string;
  year: string;
  type: string;
  episodes: EpisodeItem[];
  metadata: Record<string, string>;
  related: RelatedAnime[];
}

export interface RelatedAnime {
  id: string;
  title: string;
  cover: string;
  info: string;
  isDub: boolean;
}

export interface UpcomingAnime {
  id: string;
  title: string;
  cover: string;
  isDub: boolean;
}

export interface EpisodeStream {
  animeId: string;
  episodeId: string;
  targetUrl: string;
  embedUrl: string;
  rawServerUrl: string;
}

export interface LatestEpisode {
  id: string;            // ID dell'episodio per il watch link
  animeId: string;       // ID/slug dell'anime per la scheda
  title: string;         // Titolo dell'anime
  episodeNumber: string; // Es. "12"
  image: string;         // Copertina
  isDub: boolean;        // Se è doppiato in ITA
  isSub: boolean;        // Se è in SUB-ITA
  time?: string;
}

export interface CalendarDay {
  date: string;
  label: string;
  episodes: LatestEpisode[];
}

export interface FeaturedAnime {
  animeId: string;
  title: string;
  description: string;
  image: string;
  banner?: string;
}

export interface MalTopAnime {
  rank: number;
  id: string;
  title: string;
  url: string;
  image: string;
  score: string;
  type: string;
  episodes: string;
  members: string;
}

const BASE_URL = 'https://www.animeworld.ac';
const MAL_TOP_URL = 'https://myanimelist.net/topanime.php';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const HOME_CACHE_TTL = 5 * 60 * 1000;
let homepageCache: { html: string; expiresAt: number } | null = null;
let homepageRequest: Promise<string> | null = null;
const malScoreCache = new Map<string, { score: string; expiresAt: number }>();
const topAnimeCache = new Map<number, { expiresAt: number; data: MalTopAnime[] }>();

// Helper per selezionare il primo valore valido
function pickFirst(...values: Array<string | undefined | null>): string {
  for (const val of values) {
    if (val && val.trim() !== '') {
      return val;
    }
  }
  return '';
}

// Helper per formattare gli URL delle immagini (relativi vs assoluti)
function formatUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return url;
}

const italianWeekdays = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const italianMonths: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12'
};

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function getAnimeWallHomepage(): Promise<string> {
  if (homepageCache && homepageCache.expiresAt > Date.now()) {
    return homepageCache.html;
  }

  if (!homepageRequest) {
    homepageRequest = axios.get(BASE_URL, {
      headers: { 'User-Agent': USER_AGENT }
    }).then((response) => {
      homepageCache = { html: response.data, expiresAt: Date.now() + HOME_CACHE_TTL };
      return response.data as string;
    }).finally(() => {
      homepageRequest = null;
    });
  }

  return homepageRequest;
}

async function getMalScore(title: string): Promise<string> {
  const key = title.trim().toLowerCase();
  const cached = malScoreCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.score;

  try {
    const response = await fetch(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1&sfw=true`,
      { headers: { Accept: 'application/json' } }
    );
    if (response.ok) {
      const payload = await response.json() as { data?: Array<{ score?: number }> };
      const score = payload.data?.[0]?.score;
      if (typeof score === 'number') {
        const formattedScore = `${score.toFixed(2)} / 10`;
        malScoreCache.set(key, { score: formattedScore, expiresAt: Date.now() + HOME_CACHE_TTL });
        return formattedScore;
      }
    }
  } catch (err) {
    console.warn('⚠️ Jikan non disponibile, provo direttamente MyAnimeList:', err);
  }

  try {
    const searchResponse = await axios.get('https://myanimelist.net/search/all', {
      params: { q: title },
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://myanimelist.net/' }
    });
    const $search = cheerio.load(searchResponse.data);
    const normalizedTitle = normalizeText(title).replace(/[^a-z0-9]+/g, ' ').trim();
    let animeUrl = '';

    $search('a[href*="/anime/"]').each((_, element) => {
      if (animeUrl) return;
      const href = $search(element).attr('href') || '';
      const candidateTitle = $search(element).text().replace(/\s+/g, ' ').trim();
      if (!/\/anime\/\d+\//.test(href)) return;
      const normalizedCandidate = normalizeText(candidateTitle).replace(/[^a-z0-9]+/g, ' ').trim();
      if (normalizedCandidate === normalizedTitle || !animeUrl) animeUrl = href;
    });

    if (!animeUrl) return '';
    const detailResponse = await axios.get(animeUrl, {
      headers: { 'User-Agent': USER_AGENT, Referer: 'https://myanimelist.net/' }
    });
    const $detail = cheerio.load(detailResponse.data);
    const score = $detail('[itemprop="ratingValue"]').first().text().trim()
      || $detail('.stats-block .score-label').first().text().trim();
    if (!score) return '';

    const formattedScore = `${Number(score).toFixed(2)} / 10`;
    malScoreCache.set(key, { score: formattedScore, expiresAt: Date.now() + HOME_CACHE_TTL });
    return formattedScore;
  } catch (err) {
    console.warn('⚠️ Voto MyAnimeList non disponibile:', err);
  }

  return '';
}

function extractCalendarDate(rawValue: string, referenceDate = new Date()): { date: string; label: string } {
  const value = normalizeText(rawValue).replace(/\s+/g, ' ').trim();
  const isoDate = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const numericDate = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b/);
  const namedDate = value.match(/\b(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\b/);
  let date = '';

  if (isoDate) {
    date = `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}`;
  } else if (numericDate) {
    const year = numericDate[3] || String(referenceDate.getFullYear());
    date = `${year}-${numericDate[2].padStart(2, '0')}-${numericDate[1].padStart(2, '0')}`;
  } else if (namedDate && italianMonths[namedDate[2]]) {
    const year = namedDate[3] || String(referenceDate.getFullYear());
    date = `${year}-${italianMonths[namedDate[2]]}-${namedDate[1].padStart(2, '0')}`;
  }

  const weekdayIndex = italianWeekdays.findIndex((weekday) => value.includes(weekday));
  if (!date && weekdayIndex !== -1) {
    const day = new Date(referenceDate);
    const distance = weekdayIndex - day.getDay();
    day.setDate(day.getDate() + distance);
    date = day.toISOString().slice(0, 10);
  }

  if (!date) return { date: '', label: 'Data non indicata' };
  return {
    date,
    label: new Intl.DateTimeFormat('it-IT', { weekday: 'long' }).format(new Date(`${date}T12:00:00`))
  };
}

export class AnimeWallService {

  static async getAnimeEpisodes(id: string): Promise<EpisodeItem[]> {
    const response = await axios.get(`${BASE_URL}/play/${id}`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const $ = cheerio.load(response.data);
    const episodes: EpisodeItem[] = [];

    $('.server .episodes a, #episodes .episode a, .episodes-list a').each((_, element) => {
      const $episode = $(element);
      const href = $episode.attr('href') || '';
      const match = href.match(/\/play\/([^/?#]+)\/([^/?#]+)/);
      if (!match || episodes.some((episode) => episode.id === match[2])) return;

      episodes.push({
        id: match[2],
        number: pickFirst($episode.attr('data-episode-num'), $episode.text().trim()),
        link: formatUrl(href)
      });
    });

    return episodes;
  }

  static async getUpcomingAnime(year: number, season: string): Promise<UpcomingAnime[]> {
    try {
      const response = await axios.get(`${BASE_URL}/upcoming/${year}/${season}`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      const $ = cheerio.load(response.data);
      const upcoming: UpcomingAnime[] = [];

      $('.widget .item').each((_, element) => {
        const $item = $(element);
        const link = $item.find('a.name, a.poster').first().attr('href') || '';
        const match = link.match(/\/play\/([^/?#]+)/);
        const title = $item.find('a.name').first().text().replace(/\s+/g, ' ').trim()
          || $item.find('img').attr('alt') || '';
        if (!match || !title || upcoming.some((item) => item.id === match[1])) return;
        const isDub = /\(ITA\)/i.test(title) || $item.find('.dub').length > 0;

        upcoming.push({
          id: match[1],
          title: title.replace(/\(ITA\)/i, '').trim(),
          cover: formatUrl($item.find('img').attr('src') || $item.find('img').attr('data-src') || ''),
          isDub
        });
      });

      return upcoming;
    } catch (err) {
      console.error('❌ Errore getUpcomingAnime:', err);
      return [];
    }
  }

  static async getTopAnime(page = 1): Promise<MalTopAnime[]> {
    const safePage = Math.max(1, Math.floor(page));
    const offset = (safePage - 1) * 50;
    const cached = topAnimeCache.get(offset);
    if (cached && cached.expiresAt > Date.now() && cached.data[0]?.rank === offset + 1) {
      return cached.data;
    }

    try {
      const params = offset > 0 ? { limit: offset } : undefined;
      const response = await axios.get(MAL_TOP_URL, {
        params,
        headers: { 'User-Agent': USER_AGENT, Referer: 'https://myanimelist.net/' }
      });
      const $ = cheerio.load(response.data);
      const topAnime: MalTopAnime[] = [];

      $('tr.ranking-list').each((index, element) => {
        const $row = $(element);
        const titleLink = $row.find('h3.anime_ranking_h3 a').first();
        const href = titleLink.attr('href') || '';
        const match = href.match(/\/anime\/(\d+)\//);
        if (!match) return;

        const info = $row.find('.information').text().replace(/\s+/g, ' ').trim();
        const score = $row.find('.score-label').first().text().trim();
        const type = info.match(/^(.*?)(?:\s*\(\d+\s+eps?\))?\s*\d{4}|^(TV|Movie|OVA|ONA|Special)/i)?.[1]?.trim() || '';
        const episodes = info.match(/\(([^)]+)\s+eps?\)/i)?.[1] || '?';
        const members = info.match(/([\d,]+)\s+members/i)?.[1] || '';
        const imageElement = $row.find('td.title img').first();
        const srcset = imageElement.attr('data-srcset') || imageElement.attr('srcset') || '';
        const highResolutionImage = srcset.split(',')
          .map((source) => source.trim().split(/\s+/))
          .find((source) => source[1] === '2x')?.[0];
        const image = highResolutionImage
          || imageElement.attr('data-src')
          || imageElement.attr('src')
          || '';

        topAnime.push({
          rank: Number($row.find('.rank').text().trim()) || offset + index + 1,
          id: match[1],
          title: titleLink.text().trim() || `Anime #${match[1]}`,
          url: href,
          image,
          score,
          type,
          episodes,
          members
        });
      });

      topAnimeCache.set(offset, { data: topAnime, expiresAt: Date.now() + HOME_CACHE_TTL });
      return topAnime;
    } catch (err) {
      console.error('❌ Errore getTopAnime:', err);
      return [];
    }
  }

  // Recupera la programmazione settimanale, con fallback sugli ultimi episodi.
  static async getCalendar(): Promise<CalendarDay[]> {
    try {
      const response = await axios.get(`${BASE_URL}/schedule`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      const $ = cheerio.load(response.data);
      const calendar: CalendarDay[] = [];

      $('.widget-schedule-page .widget-body > .costr').each((_, header) => {
        const label = $(header).find('.day-header').text().trim();
        const calendarDate = extractCalendarDate(label);
        const day: CalendarDay = { ...calendarDate, episodes: [] };
        const rows = $(header).next('.calendario-aw').find('.boxcalendario');

        rows.each((__, row) => {
          const $row = $(row);
          const link = $row.find('a[href*="/play/"]').first().attr('href') || '';
          const match = link.match(/\/play\/([^/?#]+)/);
          if (!match) return;

          const titleLink = $row.find('a.name').first();
          const rawTitle = titleLink.text().trim()
            || titleLink.attr('title')
            || $row.find('a[title]').first().attr('title')
            || 'Anime senza titolo';
          const episodeNumber = $row.text().match(/Episodio\s+(\d+)/i)?.[1] || '1';
          const time = $row.text().match(/Trasmesso\s+alle\s+(\d{1,2}:\d{2})/i)?.[1] || '';
          const isDub = /\(ITA\)/i.test(rawTitle) || $row.find('.dub').length > 0;
          const imageStyle = $row.find('.img-anime').first().attr('style') || '';
          const image = imageStyle.match(/url\((['"]?)(.*?)\1\)/i)?.[2] || '';

          day.episodes.push({
            animeId: match[1],
            id: episodeNumber,
            title: rawTitle.replace(/\(ITA\)/i, '').trim(),
            episodeNumber,
            image: formatUrl(image),
            isDub,
            isSub: !isDub,
            time
          });
        });

        if (day.episodes.length > 0) calendar.push(day);
      });

      if (calendar.length > 0) return calendar;
    } catch (err) {
      console.warn('⚠️ Calendario sorgente non disponibile, uso le ultime uscite:', err);
    }

    const latestEpisodes = await this.getLatestEpisodes();
    return [{ date: '', label: 'Ultime uscite', episodes: latestEpisodes }];
  }

  // 🌟 Recupera gli ultimi episodi pubblicati
  static async getLatestEpisodes(): Promise<LatestEpisode[]> {
    try {
      const $ = cheerio.load(await getAnimeWallHomepage());
      const episodes: LatestEpisode[] = [];

      // ✅ Usiamo il selettore esatto visto nell'ispezione elemento
      $('.film-list .item').each((_, el) => {
        const $el = $(el);
        const link = $el.find('a.poster').attr('href') || $el.find('a.name').attr('href') || '';
        const title = $el.find('.name, .title').text().trim() || $el.find('img').attr('alt') || '';
        const image = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
        const epBadge = $el.find('.ep, .episode').text().trim();
        const isDub = $el.find('.dub').length > 0 || title.toLowerCase().includes('(ita)');

        const match = link.match(/\/play\/([^/]+)\/([^/]+)/);
        if (match) {
          episodes.push({
            animeId: match[1],
            id: match[2],
            title: title.replace(/\(ITA\)/i, '').trim(),
            episodeNumber: epBadge.replace(/ep\.?/i, '').trim() || '1',
            image,
            isDub,
            isSub: !isDub
          });
        }
      });

      return episodes;
    } catch (err) {
      console.error('❌ Errore getLatestEpisodes:', err);
      return [];
    }
  }

  // 🎬 Recupera il banner/anime in evidenza (Slider Hero)
  static async getFeaturedAnime(): Promise<FeaturedAnime[]> {
    try {
      const $ = cheerio.load(await getAnimeWallHomepage());
      const featured: FeaturedAnime[] = [];

      $('.swiper-slide, .hero-slider .item').each((_, el) => {
        const $el = $(el);
        const title = $el.find('.title, h2').text().trim();
        const description = $el.find('.desc, p').text().trim();
        const image = $el.find('img').attr('src') || '';
        const link = $el.find('a').attr('href') || '';
        
        const animeIdMatch = link.match(/\/play\/([^/]+)/) || link.match(/\/anime\/([^/]+)/);

        if (title && animeIdMatch) {
          featured.push({
            animeId: animeIdMatch[1],
            title,
            description,
            image
          });
        }
      });

      return featured;
    } catch (err) {
      console.error('❌ Errore getFeaturedAnime:', err);
      return [];
    }
  }

  /**
   * Cerca anime su AnimeWall
   */
  static async searchAnime(query: string): Promise<AnimeSearchResult[]> {
    try {
      const searchUrl = `${BASE_URL}/filter?keyword=${encodeURIComponent(query)}`;

      const response = await axios.get(searchUrl, {
        headers: { 'User-Agent': USER_AGENT }
      });

      const $ = cheerio.load(response.data);
      const results: AnimeSearchResult[] = [];

      $('.film-list .item, .all-anime .item, .item').each((_, element) => {
        const linkElement = $(element).find('a.name, a.poster, a').first();
        const rawLink = linkElement.attr('href');
        const link = pickFirst(rawLink);

        if (!link || (!link.includes('/play/') && !link.includes('/anime/'))) {
          return;
        }

        const foundTitle = $(element).find('.name, .title, .title-anime').text().trim();
        const rawTitle = pickFirst(foundTitle, linkElement.text().trim());

        // AnimeWall marca le versioni doppiate con un badge ".dub" e con "(ITA)" nel titolo
        const isDub =
          $(element).find('.status .dub, .dub').length > 0 ||
          rawTitle.toLowerCase().includes('(ita)');
        const title = rawTitle.replace(/\(ITA\)/i, '').trim();

        const imgElement = $(element).find('img');
        const srcAttr = imgElement.attr('src');
        const dataSrcAttr = imgElement.attr('data-src');
        const rawCover = pickFirst(dataSrcAttr, srcAttr);
        const cover = formatUrl(rawCover);

        const rawExtraInfo = $(element).find('.genre, .status, .type, .extra').text();
        const extraInfo = rawExtraInfo.replace(/\s+/g, ' ').trim();

        const fullLink = formatUrl(link);
        const parts = link.split('/');
        const id = parts[parts.length - 1] ? parts[parts.length - 1] : '';

        if (title && !results.some((r) => r.link === fullLink)) {
          results.push({
            id,
            title,
            link: fullLink,
            cover,
            extraInfo,
            isDub,
            isSub: !isDub
          });
        }
      });

      return results;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore durante lo scraping della ricerca:', errorMessage);
      throw new Error(`Impossibile effettuare la ricerca: ${errorMessage}`);
    }
  }

  /**
   * Estrae i dettagli di una scheda anime e la lista degli episodi
   */
  static async getAnimeDetails(id: string): Promise<AnimeDetails> {
    try {
      const animeUrl = `${BASE_URL}/play/${id}`;

      const response = await axios.get(animeUrl, {
        headers: { 'User-Agent': USER_AGENT }
      });

      const $ = cheerio.load(response.data);

      // 🎯 1. TITOLO PULITO
      const rawTitle = $('#info h1, h1#title, h1.title, .widget-title').first().text().trim()
                    || $('meta[property="og:title"]').attr('content') || '';

      const title = rawTitle
        .replace(/\s*Episodio\s*\d+.*$/i, '')
        .replace(/\s*Streaming\s*&\s*Download.*$/i, '')
        .replace(/\s*-\s*AnimeWall.*$/i, '')
        .trim();

      // 🎯 2. COPERTINA BULLETPROOF (Multi-strategia)
      let rawCover = '';

      // Strategia A: Cerca nei contenitori primari dell'anime (supporta src, data-src, data-original)
      const primaryImgs = $('#widget-info img, #info img, .widget.info img, .thumb img, .poster img, .cover img');
      primaryImgs.each((_, el) => {
        if (rawCover) return;
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original');
        if (src && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
          rawCover = src;
        }
      });

      // Strategia B: Se non trovata, scansiona TUTTE le immagini della pagina cercando caricamenti /uploads/ o cdn
      if (!rawCover) {
        $('img').each((_, el) => {
          if (rawCover) return;
          const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original');
          if (src && (src.includes('/uploads/') || src.includes('cdn')) && !src.includes('logo')) {
            rawCover = src;
          }
        });
      }

      // Strategia C: Fallback sui Meta Tag OpenGraph / Twitter
      if (!rawCover) {
        rawCover = $('meta[property="og:image"]').attr('content')
                || $('meta[name="twitter:image"]').attr('content')
                || '';
      }

      const cover = formatUrl(rawCover);

      const plot = $('#desc, .desc, .description').text().trim();

      const genres: string[] = [];
      $('.meta .genre a, .info a[href*="/genre/"], #info a[href*="/genre/"]').each((_, el) => {
        const genre = $(el).text().trim();
        if (genre && !genres.includes(genre)) {
          genres.push(genre);
        }
      });

      let status = '';
      let year = '';
      let type = '';

      const metadata: Record<string, string> = {};
      $('.widget.info dl.meta').each((_, dl) => {
        $(dl).children('dt').each((__, term) => {
          const key = $(term).text().replace(/:/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
          const value = $(term).next('dd').text().replace(/\s+/g, ' ').trim();
          if (key && value) metadata[key] = value;
        });
      });

      if (!metadata.genere) metadata.genere = genres.join(', ');
      if (!metadata.stato && status) metadata.stato = status;
      const malScore = await getMalScore(title);
      if (malScore) metadata.voto = malScore;

      $('#info .row div, #info .meta-item, #info .info-item, #info dt, #info dd, #info div').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();

        if (!status && text.includes('Stato:')) {
          status = text.split('Stato:')[1] ? text.split('Stato:')[1].trim() : '';
        }
        if (!year && (text.includes('Data di uscita:') || text.includes('Anno:'))) {
          const parts = text.includes('Data di uscita:') ? text.split('Data di uscita:') : text.split('Anno:');
          year = parts[1] ? parts[1].trim() : '';
        }
        if (!type && text.includes('Tipo:')) {
          type = text.split('Tipo:')[1] ? text.split('Tipo:')[1].trim() : '';
        }
      });

      const related: RelatedAnime[] = [];
      $('.widget.simple-film-list .item').each((_, element) => {
        const $item = $(element);
        const relatedLink = $item.find('a[href*="/play/"]').first();
        const href = relatedLink.attr('href') || '';
        const relatedMatch = href.match(/\/play\/([^/?#]+)/);
        if (!relatedMatch) return;

        const relatedTitle = relatedLink.text().replace(/\s+/g, ' ').trim();
        const itemText = $item.text().replace(/\s+/g, ' ').trim();
        const info = itemText.replace(relatedTitle, '').replace(/^\s*-\s*/, '').trim();
        const isDub = /\(ITA\)/i.test(relatedTitle) || $item.find('.dub').length > 0;
        if (relatedTitle && !related.some((item) => item.id === relatedMatch[1])) {
          related.push({
            id: relatedMatch[1],
            title: relatedTitle.replace(/\(ITA\)/i, '').trim(),
            cover: formatUrl($item.find('img').attr('src') || $item.find('img').attr('data-src') || ''),
            info,
            isDub
          });
        }
      });

      const episodes: EpisodeItem[] = [];

      $('.server .episodes a, #episodes .episode a, .episodes-list a').each((_, el) => {
        const attrNum = $(el).attr('data-episode-num');
        const epNum = pickFirst(attrNum, $(el).text().trim());

        const epHrefAttr = $(el).attr('href');
        const epHref = pickFirst(epHrefAttr);
        const epParts = epHref.split('/');
        const epId = epParts[epParts.length - 1] ? epParts[epParts.length - 1] : '';

        if (epHref && !episodes.some((e) => e.link === epHref)) {
          episodes.push({
            id: epId,
            number: epNum,
            link: formatUrl(epHref)
          });
        }
      });

      return {
        id,
        title,
        cover,
        plot,
        genres,
        status,
        year,
        type,
        episodes,
        metadata,
        related
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
      console.error('Errore durante il recupero dei dettagli anime:', errorMessage);
      throw new Error(`Impossibile recuperare l'anime ${id}: ${errorMessage}`);
    }
  }

    /**
     * Estrae l'URL dell'embed video per un determinato episodio
     */
static async getEpisodeStream(animeId: string, episodeId: string, targetServerId?: string) {
  try {
    const episodeUrl = `${BASE_URL}/play/${animeId}/${episodeId}`;

    const response = await axios.get(episodeUrl, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Referer': BASE_URL
      }
    });

    const $ = cheerio.load(response.data);
    const episodeNumber = $('h1, #info h1, title')
      .toArray()
      .map((element) => $(element).text())
      .join(' ')
      .match(/episodio\s*(\d+)/i)?.[1] || '';

    // Individua l'ID del player selezionato o quello di default
    const selectedDataId = targetServerId 
                        || $('#player').attr('data-id') 
                        || $('.player-box').attr('data-id') 
                        || $('[data-id]').first().attr('data-id');

    if (!selectedDataId) {
      throw new Error('Impossibile trovare l\'ID del player video.');
    }

    // 🎯 Restituisce il link al nostro proxy interno anziché il link diretto di AnimeWall
    const embedUrl = `/api/player-proxy?id=${selectedDataId}`;

    return {
      embedUrl,
      activeServer: selectedDataId,
      episodeNumber
    };

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('Errore getEpisodeStream:', errorMessage);
    throw new Error(`Impossibile recuperare lo streaming: ${errorMessage}`);
  }
}
}
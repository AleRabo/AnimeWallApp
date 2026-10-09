export interface ContinueWatchingItem {
  animeId: string;
  episodeId: string;
  title: string;
  cover: string;
  episodeNumber: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  updatedAt: number;
}

const STORAGE_KEY = 'animewall-continue-watching';
export const CONTINUE_WATCHING_EVENT = 'animewall-continue-watching-updated';

function isItem(value: unknown): value is ContinueWatchingItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ContinueWatchingItem>;
  return typeof item.animeId === 'string'
    && typeof item.episodeId === 'string'
    && typeof item.updatedAt === 'number';
}

export function getContinueWatching(): ContinueWatchingItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter(isItem).sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch (error) {
    console.error('Impossibile leggere Continua a guardare:', error);
    return [];
  }
}

export function saveContinueWatching(item: ContinueWatchingItem) {
  if (typeof window === 'undefined') return;

  const items = getContinueWatching().filter(
    (current) => !(current.animeId === item.animeId && current.episodeId === item.episodeId)
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...items].slice(0, 50)));
  window.dispatchEvent(new Event(CONTINUE_WATCHING_EVENT));
}

export function removeContinueWatching(animeId: string, episodeId: string) {
  if (typeof window === 'undefined') return;

  const items = getContinueWatching().filter(
    (item) => item.animeId !== animeId || item.episodeId !== episodeId
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CONTINUE_WATCHING_EVENT));
}

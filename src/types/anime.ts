export interface AnimeSearchResult {
  id: string;
  title: string;
  link: string;
  coverUrl: string;
  releaseYear?: string;
  type?: string; // TV, Movie, OVA, ecc.
}

export interface Episode {
  id: string;
  number: string;
  link: string;
}

export interface AnimeDetail {
  id: string;
  title: string;
  coverUrl: string;
  synopsis: string;
  genres: string[];
  status: string;
  episodes: Episode[];
}

export interface VideoStream {
  quality: string;
  url: string;
  format: 'mp4' | 'hls'; // hls se .m3u8
}
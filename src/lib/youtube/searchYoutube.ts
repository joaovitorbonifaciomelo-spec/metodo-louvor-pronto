export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
}

/**
 * Busca vídeos via YouTube Data API v3 oficial (seção 9 do briefing) —
 * NUNCA scraping. Server-only: a chave nunca deve ter prefixo NEXT_PUBLIC_.
 */
export async function searchYoutube(query: string, maxResults = 5): Promise<YoutubeSearchResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error("YOUTUBE_API_KEY não configurada. Veja .env.example.");
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("q", query);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`YouTube Data API respondeu ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } };
    }[];
  };

  return (json.items ?? [])
    .filter((item) => item.id?.videoId)
    .map((item) => ({
      videoId: item.id!.videoId!,
      title: item.snippet?.title ?? "",
      channelTitle: item.snippet?.channelTitle ?? "",
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
    }));
}

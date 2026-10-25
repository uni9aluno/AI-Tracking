import type {
  ApiStatusResponse,
  BenchmarksResponse,
  ModelsResponse,
  NewsItem,
  NewsResponse,
  Overview,
  PapersResponse,
  TrendingResponse,
} from "../shared/types";
import { storyWeight } from "../shared/news";

const DAY = 86_400_000;

/**
 * Highlights: stories of the last 48 h ranked by storyWeight, newest first on ties. Only stories carried
 * by 2+ sources or with 250+ Hacker News points qualify.
 */
export function highlights(items: NewsItem[], now = Date.now(), limit = 8) {
  return items
    .filter(i => now - Date.parse(i.publishedAt) < 2 * DAY && storyWeight(i) >= 2)
    .sort((a, b) => storyWeight(b) - storyWeight(a) || b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

export function buildOverview(
  data: {
    news: NewsResponse | null;
    models: ModelsResponse | null;
    papers: PapersResponse | null;
    trending: TrendingResponse | null;
    benchmarks: BenchmarksResponse | null;
    apiStatus: ApiStatusResponse | null;
  },
  now = Date.now()
): Overview {
  const items = data.news?.items ?? [];
  const newModels = (data.models?.models ?? []).filter(
    m => now - Date.parse(m.createdAt) < 7 * DAY
  );
  const sources = Object.values(data).flatMap(d => d?.sources ?? []);
  return {
    updatedAt: new Date(now).toISOString(),
    highlights: highlights(items, now),
    latest: items.slice(0, 12),
    newModels: newModels.slice(0, 12),
    services: data.apiStatus?.services ?? [],
    repos: (data.trending?.repos ?? []).slice(0, 6),
    hfModels: (data.trending?.hfModels ?? []).slice(0, 6),
    papers: (data.papers?.trending ?? []).slice(0, 6),
    arenaTop: (data.benchmarks?.arenas ?? []).slice(0, 3).map(a => ({
      board: a.id,
      label: a.label,
      metric: a.metric,
      rows: a.rows.slice(0, 5),
    })),
    counts: {
      news24h: items.filter(i => now - Date.parse(i.publishedAt) < DAY).length,
      newModels7d: newModels.length,
      sources: sources.length,
      failing: sources.filter(s => s.status === "error").length,
    },
    sources,
  };
}

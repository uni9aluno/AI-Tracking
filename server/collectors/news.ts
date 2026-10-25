import type {
  NewsItem,
  NewsResponse,
  SourceKind,
  SourceStatus,
} from "../../shared/types";
import {
  classify,
  companyFacets,
  isAiRelated,
  modelFacets,
} from "../classify";
import {
  createCollector,
  logLine,
  overallStatus,
  sourceStatus,
} from "../lib/collector";
import { dedupeKey, parseFeed, type FeedEntry } from "../lib/feed";
import { errorMessage, fetchText } from "../lib/http";
import { readCache, writeCache } from "../store";

export type NewsFeed = {
  id: string;
  label: string;
  url: string;
  kind: SourceKind;
  lang: "en" | "pt";
  /** Official blog of this company: every post is tagged with it and with "novidades". */
  company?: string;
  /** General-interest feed: keep only AI stories. */
  aiOnly?: boolean;
  /** Google News appends " - Outlet" to every title. */
  stripOutlet?: boolean;
  /** Cap below MAX_PER_FEED, for broad sources that would flood the list. */
  limit?: number;
};

// Checked on 25/10/2026; dropped feeds and why are in docs/fontes.md.
export const NEWS_FEEDS: NewsFeed[] = [
  { id: "openai", label: "OpenAI", url: "https://openai.com/news/rss.xml", kind: "laboratorio", lang: "en", company: "openai" },
  { id: "deepmind", label: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", kind: "laboratorio", lang: "en", company: "google" },
  { id: "google-ai", label: "Google AI", url: "https://blog.google/technology/ai/rss/", kind: "laboratorio", lang: "en", company: "google" },
  { id: "google-research", label: "Google Research", url: "https://research.google/blog/rss/", kind: "laboratorio", lang: "en", company: "google" },
  { id: "huggingface", label: "Hugging Face", url: "https://huggingface.co/blog/feed.xml", kind: "laboratorio", lang: "en", company: "huggingface" },
  { id: "mistral", label: "Mistral AI", url: "https://mistral.ai/rss.xml", kind: "laboratorio", lang: "en", company: "mistral" },
  { id: "microsoft-research", label: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/feed/", kind: "laboratorio", lang: "en", company: "microsoft", aiOnly: true },
  { id: "nvidia", label: "NVIDIA", url: "https://blogs.nvidia.com/feed/", kind: "laboratorio", lang: "en", company: "nvidia", aiOnly: true },
  // Anthropic, Meta AI and xAI publish no feed; Google News search covers them.
  { id: "gnews-labs", label: "Google Notícias (Anthropic, Meta, xAI)", url: "https://news.google.com/rss/search?q=Anthropic+OR+Claude+OR+%22Meta+AI%22+OR+xAI+OR+Grok+when:2d&hl=en-US&gl=US&ceid=US:en", kind: "imprensa", lang: "en", stripOutlet: true, limit: 12 },
  { id: "verge", label: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", kind: "imprensa", lang: "en" },
  { id: "techcrunch", label: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/", kind: "imprensa", lang: "en" },
  { id: "ars", label: "Ars Technica", url: "https://arstechnica.com/ai/feed/", kind: "imprensa", lang: "en" },
  { id: "mit-tr", label: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", kind: "imprensa", lang: "en" },
  { id: "simonw", label: "Simon Willison", url: "https://simonwillison.net/atom/everything/", kind: "imprensa", lang: "en", aiOnly: true },
  { id: "tecnoblog", label: "Tecnoblog", url: "https://tecnoblog.net/feed/", kind: "imprensa", lang: "pt", aiOnly: true },
  // The Canaltech AI-section feed stopped in July 2026; the main feed is filtered instead.
  { id: "canaltech", label: "Canaltech", url: "https://canaltech.com.br/rss/", kind: "imprensa", lang: "pt", aiOnly: true },
  { id: "olhar-digital", label: "Olhar Digital", url: "https://olhardigital.com.br/editorias/pro/inteligencia-artificial/feed/", kind: "imprensa", lang: "pt" },
  { id: "infomoney", label: "InfoMoney", url: "https://www.infomoney.com.br/tudo-sobre/inteligencia-artificial/feed/", kind: "imprensa", lang: "pt" },
  { id: "hn", label: "Hacker News", url: "https://hnrss.org/newest?q=AI+OR+LLM+OR+GPT+OR+Claude+OR+Gemini+OR+OpenAI+OR+Anthropic&points=100", kind: "comunidade", lang: "en" },
  { id: "r-localllama", label: "r/LocalLLaMA", url: "https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day", kind: "comunidade", lang: "en" },
  { id: "r-machinelearning", label: "r/MachineLearning", url: "https://www.reddit.com/r/MachineLearning/top/.rss?t=day", kind: "comunidade", lang: "en" },
];

export const NEWS_INTERVAL_MS = 5 * 60_000;
const WINDOW_MS = 7 * 24 * 3_600_000;
const MAX_PER_FEED = 30;
const MAX_ITEMS = 1500;
// Tolerated clock skew before a "future" date is clamped to now.
const FUTURE_SKEW_MS = 10 * 60_000;

const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++)
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

const hnPoints = (raw: string) => {
  const match = raw.match(/Points:\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
};

/** Turn one feed's entries into classified items, newest first, within the window. */
export function feedItems(
  feed: NewsFeed,
  entries: FeedEntry[],
  now = Date.now()
): NewsItem[] {
  const items: NewsItem[] = [];
  for (const entry of entries) {
    let time = Date.parse(entry.publishedAt);
    if (time > now + FUTURE_SKEW_MS) time = now;
    if (now - time > WINDOW_MS) continue;
    let title = entry.title;
    let source = feed.label;
    if (feed.stripOutlet) {
      const cut = title.lastIndexOf(" - ");
      if (cut > 20) {
        source = title.slice(cut + 3).trim() || source;
        title = title.slice(0, cut).trim();
      }
    }
    // Google News and Hacker News summaries are only link lists.
    const summary =
      feed.stripOutlet || feed.id === "hn" ? "" : entry.summary;
    if (feed.aiOnly && !isAiRelated(`${title} ${entry.categories.join(" ")} ${summary}`, feed.lang))
      continue;
    const { topics, companies, models } = classify(title, summary, {
      company: feed.company,
      official: feed.kind === "laboratorio",
    });
    items.push({
      id: hash(entry.link),
      title,
      link: entry.link,
      summary,
      source,
      sourceId: feed.id,
      kind: feed.kind,
      lang: feed.lang,
      publishedAt: new Date(time).toISOString(),
      topics,
      companies,
      models,
      ...(feed.id === "hn" ? { score: hnPoints(entry.rawDescription) } : {}),
      alsoIn: [],
    });
  }
  return items
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, feed.limit ?? MAX_PER_FEED);
}

/**
 * Previous history + fresh items, one entry per story: a story seen by another source only adds that
 * source to `alsoIn`. Items older than the window are dropped.
 */
export function mergeNews(
  previous: NewsItem[],
  fresh: NewsItem[],
  now = Date.now()
): NewsItem[] {
  const byKey = new Map<string, NewsItem>();
  const byLink = new Set<string>();
  const add = (item: NewsItem) => {
    if (now - Date.parse(item.publishedAt) > WINDOW_MS) return;
    if (byLink.has(item.link)) return;
    const key = dedupeKey(item.title) || item.id;
    const existing = byKey.get(key);
    if (existing) {
      if (existing.sourceId !== item.sourceId && existing.source !== item.source && !existing.alsoIn.includes(item.source))
        existing.alsoIn.push(item.source);
      return;
    }
    byLink.add(item.link);
    byKey.set(key, { ...item, alsoIn: [...item.alsoIn] });
  };
  // Older first, so the first publisher of a story keeps it.
  [...previous, ...fresh]
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .forEach(add);
  return [...byKey.values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_ITEMS);
}

async function collectFeed(
  feed: NewsFeed
): Promise<{ status: SourceStatus; items: NewsItem[] }> {
  const started = Date.now();
  try {
    const { body, latencyMs } = await fetchText(feed.url);
    const items = feedItems(feed, parseFeed(body));
    return {
      items,
      status: sourceStatus(feed, { ok: true, latencyMs, itemCount: items.length }),
    };
  } catch (error) {
    return {
      items: [],
      status: sourceStatus(feed, {
        ok: false,
        latencyMs: Date.now() - started,
        message: errorMessage(error),
      }),
    };
  }
}

const CACHE_NAME = "news";

async function build(previous: NewsResponse | null): Promise<NewsResponse> {
  const results = await Promise.all(NEWS_FEEDS.map(collectFeed));
  const sources = results.map(r => r.status);
  // History is reclassified every round, so a rule change also reaches the stories already stored.
  const history = (previous?.items ?? []).map(item => {
    const feed = NEWS_FEEDS.find(f => f.id === item.sourceId);
    return feed
      ? {
          ...item,
          ...classify(item.title, item.summary, {
            company: feed.company,
            official: feed.kind === "laboratorio",
          }),
        }
      : item;
  });
  const items = mergeNews(history, results.flatMap(r => r.items));
  const value: NewsResponse = {
    updatedAt: new Date().toISOString(),
    // "empty" is normal for a quiet feed over a weekend; only errors make the panel partial.
    status: overallStatus(
      sources.map(s => (s.status === "empty" ? { ...s, status: "ok" } : s))
    ),
    sources,
    items,
    companies: companyFacets(items.flatMap(i => i.companies)),
    models: modelFacets(items.flatMap(i => i.models)),
  };
  writeCache(CACHE_NAME, value);
  return value;
}

export const newsCollector = createCollector<NewsResponse>({
  name: "news",
  intervalMs: NEWS_INTERVAL_MS,
  build,
  initial: readCache<NewsResponse>(CACHE_NAME),
  log: v =>
    logLine("noticias", v.status, `${v.items.length} itens em 7 dias`, v.sources),
});

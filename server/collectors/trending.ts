import type {
  HubItem,
  Repo,
  SourceStatus,
  TrendingResponse,
} from "../../shared/types";
import {
  createCollector,
  logLine,
  overallStatus,
  sourceStatus,
} from "../lib/collector";
import { safeLink, truncate } from "../lib/feed";
import { errorMessage, fetchJson } from "../lib/http";
import { readCache, writeCache } from "../store";

// GitHub search allows 10 calls/min without a token; two calls every 30 min are far below it.
export const TRENDING_INTERVAL_MS = 30 * 60_000;
const GITHUB_TOPICS = ["llm", "ai-agents", "generative-ai"];

const daysAgo = (days: number, now = Date.now()) =>
  new Date(now - days * 86_400_000).toISOString().slice(0, 10);

const githubSource = (topic: string) => ({
  id: `github-${topic}`,
  label: `GitHub (topic:${topic}, últimos 30 dias)`,
  url: `https://api.github.com/search/repositories?q=topic:${topic}+created:%3E${daysAgo(30)}&sort=stars&order=desc&per_page=30`,
});
const HF_MODELS = {
  id: "hf-models",
  label: "Hugging Face (modelos em alta)",
  url: "https://huggingface.co/api/models?sort=trendingScore&limit=30",
};
const HF_SPACES = {
  id: "hf-spaces",
  label: "Hugging Face (Spaces em alta)",
  url: "https://huggingface.co/api/spaces?sort=trendingScore&limit=30",
};

type GithubSearch = {
  items?: {
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    language: string | null;
    created_at: string;
    topics?: string[];
  }[];
};
type HfRaw = {
  id: string;
  likes?: number;
  downloads?: number;
  trendingScore?: number;
  pipeline_tag?: string;
  sdk?: string;
  createdAt?: string;
};

export function parseGithub(data: GithubSearch): Repo[] {
  return (data.items ?? [])
    .filter(r => r.full_name && safeLink(r.html_url))
    .map(r => ({
      id: r.full_name,
      name: r.full_name,
      url: safeLink(r.html_url),
      description: truncate((r.description ?? "").replace(/\s+/g, " ").trim(), 220),
      stars: r.stargazers_count ?? 0,
      language: r.language,
      createdAt: r.created_at,
      topics: (r.topics ?? []).slice(0, 8),
    }));
}

export function parseHub(data: HfRaw[], kind: "model" | "space"): HubItem[] {
  return (Array.isArray(data) ? data : [])
    .filter(d => d?.id)
    .map(d => ({
      id: d.id,
      url: `https://huggingface.co/${kind === "space" ? "spaces/" : ""}${d.id}`,
      likes: d.likes ?? 0,
      downloads: d.downloads ?? null,
      trendingScore: d.trendingScore ?? 0,
      task: (kind === "model" ? d.pipeline_tag : d.sdk) ?? null,
      createdAt: d.createdAt ?? null,
      kind,
    }));
}

async function attempt<T>(
  base: { id: string; label: string; url: string },
  run: (url: string) => Promise<{ items: T[]; latencyMs: number }>
): Promise<{ status: SourceStatus; items: T[] | null }> {
  const started = Date.now();
  try {
    const { items, latencyMs } = await run(base.url);
    return {
      items,
      status: sourceStatus(base, { ok: true, latencyMs, itemCount: items.length }),
    };
  } catch (error) {
    return {
      items: null,
      status: sourceStatus(base, {
        ok: false,
        latencyMs: Date.now() - started,
        message: errorMessage(error),
      }),
    };
  }
}

const CACHE_NAME = "trending";

async function build(previous: TrendingResponse | null): Promise<TrendingResponse> {
  const [models, spaces, ...github] = await Promise.all([
    attempt(HF_MODELS, async url => {
      const { body, latencyMs } = await fetchJson<HfRaw[]>(url);
      return { items: parseHub(body, "model"), latencyMs };
    }),
    attempt(HF_SPACES, async url => {
      const { body, latencyMs } = await fetchJson<HfRaw[]>(url);
      return { items: parseHub(body, "space"), latencyMs };
    }),
    ...GITHUB_TOPICS.map(topic =>
      attempt(githubSource(topic), async url => {
        const { body, latencyMs } = await fetchJson<GithubSearch>(url);
        return { items: parseGithub(body), latencyMs };
      })
    ),
  ]);
  const sources = [models.status, spaces.status, ...github.map(g => g.status)];
  const repos = new Map<string, Repo>();
  for (const g of github) for (const r of g.items ?? []) repos.set(r.id, r);
  const value: TrendingResponse = {
    updatedAt: new Date().toISOString(),
    status: overallStatus(sources),
    sources,
    repos: repos.size
      ? [...repos.values()].sort((a, b) => b.stars - a.stars).slice(0, 40)
      : (previous?.repos ?? []),
    hfModels: models.items?.length ? models.items : (previous?.hfModels ?? []),
    hfSpaces: spaces.items?.length ? spaces.items : (previous?.hfSpaces ?? []),
  };
  writeCache(CACHE_NAME, value);
  return value;
}

export const trendingCollector = createCollector<TrendingResponse>({
  name: "trending",
  intervalMs: TRENDING_INTERVAL_MS,
  retryMs: 5 * 60_000,
  build,
  initial: readCache<TrendingResponse>(CACHE_NAME),
  log: v =>
    logLine(
      "em-alta",
      v.status,
      `${v.repos.length} repositórios, ${v.hfModels.length} modelos, ${v.hfSpaces.length} spaces`,
      v.sources
    ),
});

import type {
  ResearchItem,
  ResearchKind,
  ResearchProvider,
  ResearchResponse,
  SourceStatus,
} from "../../shared/types";
import { parseCards, type CardOptions } from "../lib/cards";
import {
  createCollector,
  logLine,
  overallStatus,
  sourceStatus,
} from "../lib/collector";
import { decodeXml, parseFeed, safeLink, truncate } from "../lib/feed";
import { errorMessage, fetchJson, fetchText } from "../lib/http";
import { readCache, writeCache } from "../store";

type Provider = Omit<ResearchProvider, "items" | "sourceIds">;

// Checked on 25/10/2026; how each page is read, and the pages left out, are in docs/fontes.md.
export const RESEARCH_PROVIDERS: Provider[] = [
  { id: "anthropic", label: "Anthropic", homepage: "https://www.anthropic.com/research", description: "Criadora do Claude. Alinhamento, interpretabilidade, impactos sociais e economia." },
  { id: "openai", label: "OpenAI", homepage: "https://openai.com/research/index/", description: "Criadora do ChatGPT. Posts de pesquisa, segurança e publicações." },
  { id: "google", label: "Google", homepage: "https://deepmind.google/research/", description: "Google DeepMind e Google Research: Gemini, Gemma e ciência." },
  { id: "moonshot", label: "Moonshot AI", homepage: "https://www.kimi.com/en/blog", description: "Criadora do Kimi. Relatórios técnicos e modelos abertos." },
  { id: "deepseek", label: "DeepSeek", homepage: "https://api-docs.deepseek.com/", description: "Lançamentos, artigos e pesos abertos da DeepSeek." },
  { id: "manus", label: "Manus", homepage: "https://manus.im/blog", description: "Agente autônomo Manus: blog de produto e engenharia." },
  { id: "meta", label: "Meta AI", homepage: "https://ai.meta.com/research/", description: "Meta Superintelligence Labs e FAIR: Muse, Llama, SAM e DINO." },
  { id: "elevenlabs", label: "ElevenLabs", homepage: "https://elevenlabs.io/blog", description: "Voz, áudio e música por IA." },
  { id: "qwen", label: "Qwen", homepage: "https://qwen.ai/research", description: "Modelos Qwen, da Alibaba: artigos e pesos abertos." },
  { id: "glm", label: "GLM (Z.ai)", homepage: "https://docs.z.ai/release-notes/new-released", description: "Modelos GLM, da Z.ai (antiga Zhipu AI)." },
  { id: "copilot", label: "Copilot", homepage: "https://microsoft.ai/news/", description: "Microsoft AI (modelos MAI e Copilot) e novidades do GitHub Copilot." },
  { id: "grok", label: "Grok (xAI)", homepage: "https://x.ai/news", description: "xAI, criadora do Grok." },
];

type SourceBase = { id: string; label: string; url: string; provider: string };
export type ResearchSource = SourceBase &
  (
    | { type: "html"; cards: CardOptions }
    /** RSS/Atom; `categories` keeps only posts in one of them, `skipCategories` drops posts in any of them. */
    | { type: "feed"; categories?: string[]; skipCategories?: string[] }
    /** Hugging Face paper search, kept only for papers claimed by one of `orgs`. */
    | { type: "hf-papers"; orgs: string[] }
    | { type: "hf-models" }
    /** Sitemap of the DeepSeek docs: the newest news page carries the whole list in its menu. */
    | { type: "deepseek-news" }
    | { type: "zai-notes" }
  );

const hfPapers = (provider: string, query: string, orgs: string[]): ResearchSource => ({
  id: `hf-papers-${provider}`,
  label: `Hugging Face Papers (${orgs.join(", ")})`,
  url: `https://huggingface.co/api/papers/search?q=${encodeURIComponent(query)}`,
  provider,
  type: "hf-papers",
  orgs,
});
const hfModels = (provider: string, author: string): ResearchSource => ({
  id: `hf-models-${provider}`,
  label: `Hugging Face (modelos de ${author})`,
  url: `https://huggingface.co/api/models?author=${author}&sort=createdAt&direction=-1&limit=12`,
  provider,
  type: "hf-models",
});

export const RESEARCH_SOURCES: ResearchSource[] = [
  { id: "anthropic-research", label: "Anthropic Research", url: "https://www.anthropic.com/research", provider: "anthropic", type: "html", cards: { path: "/research/[a-z0-9-]+", exclude: "/research/team/.*" } },
  { id: "openai-research", label: "OpenAI (posts de pesquisa)", url: "https://openai.com/news/rss.xml", provider: "openai", type: "feed", categories: ["Research", "Publication", "Safety & Alignment"] },
  hfPapers("openai", "openai", ["openai"]),
  hfModels("openai", "openai"),
  { id: "deepmind-blog", label: "Google DeepMind", url: "https://deepmind.google/blog/rss.xml", provider: "google", type: "feed" },
  { id: "google-research-blog", label: "Google Research", url: "https://research.google/blog/rss/", provider: "google", type: "feed" },
  hfPapers("google", "deepmind", ["google", "deepmind"]),
  hfModels("google", "google"),
  { id: "kimi-blog", label: "Kimi Blog", url: "https://www.kimi.com/en/blog", provider: "moonshot", type: "html", cards: { path: "/(?:en/)?blog/[a-z0-9-]+" } },
  hfPapers("moonshot", "kimi", ["moonshotai"]),
  hfModels("moonshot", "moonshotai"),
  { id: "deepseek-news", label: "DeepSeek API Docs (News)", url: "https://api-docs.deepseek.com/sitemap.xml", provider: "deepseek", type: "deepseek-news" },
  hfPapers("deepseek", "deepseek", ["deepseek-ai"]),
  hfModels("deepseek", "deepseek-ai"),
  { id: "manus-blog", label: "Manus Blog", url: "https://manus.im/blog", provider: "manus", type: "html", cards: { path: "/blog/[A-Za-z0-9-]+", exclude: "/blog/(customer-stories|product|academy|resources|other)" } },
  // Each card ends with a "Read the Paper" link, so the text sits before it.
  { id: "meta-publications", label: "AI at Meta (publicações)", url: "https://ai.meta.com/results/?content_types%5B0%5D=publication", provider: "meta", type: "html", cards: { path: "/research/publications/[a-z0-9-]+", cardAt: "before" } },
  { id: "meta-blog", label: "AI at Meta Blog", url: "https://ai.meta.com/blog/", provider: "meta", type: "html", cards: { path: "/blog/[a-z0-9-]+" } },
  hfPapers("meta", "meta", ["facebook", "meta", "MetaSuperintelligenceLab"]),
  hfModels("meta", "facebook"),
  // "Resources" are how-to guides and "Customer Stories" are case studies, not research.
  { id: "elevenlabs-blog", label: "ElevenLabs Blog", url: "https://elevenlabs.io/blog/rss.xml", provider: "elevenlabs", type: "feed", skipCategories: ["Resources", "Customer Stories"] },
  hfPapers("qwen", "qwen", ["Qwen"]),
  hfModels("qwen", "Qwen"),
  { id: "zai-notes", label: "Z.ai (notas de lançamento)", url: "https://docs.z.ai/release-notes/new-released.md", provider: "glm", type: "zai-notes" },
  hfPapers("glm", "GLM", ["zai-org"]),
  hfModels("glm", "zai-org"),
  // The plain /feed/ is empty; the "new" post type is Microsoft AI's news. ~2 MB, with full posts.
  { id: "microsoft-ai", label: "Microsoft AI (notícias)", url: "https://microsoft.ai/feed/?post_type=new", provider: "copilot", type: "feed" },
  { id: "github-copilot", label: "GitHub Changelog (Copilot)", url: "https://github.blog/changelog/label/copilot/feed/", provider: "copilot", type: "feed" },
  { id: "xai-news", label: "xAI News", url: "https://x.ai/news", provider: "grok", type: "html", cards: { path: "/news/[a-z0-9-]+" } },
];

// Research pages change a few times a week; 30 min keeps them fresh without pressing anyone.
export const RESEARCH_INTERVAL_MS = 30 * 60_000;
const MAX_PER_SOURCE = 20;
const MAX_WEIGHTS = 8;
const MAX_PER_PROVIDER = 60;

const item = (
  source: ResearchSource,
  kind: ResearchKind,
  fields: Omit<ResearchItem, "id" | "kind" | "sourceId" | "sourceLabel">
): ResearchItem => ({
  id: `${source.id}:${fields.link}`,
  ...fields,
  kind,
  sourceId: source.id,
  sourceLabel: source.label,
});

/** Dated items newest first; undated ones after them, in the order the page showed them. */
export function sortResearch(items: ResearchItem[]) {
  const dated = items
    .filter(i => i.publishedAt)
    .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!));
  return [...dated, ...items.filter(i => !i.publishedAt)];
}

/**
 * Anthropic's page data (Next.js) carries the exact "publishedOn" of every post, by slug. A post appears
 * first in full and later as short references without a date, so the match never crosses into another
 * object ("_id") and the first date seen wins.
 */
export function anthropicDates(html: string) {
  const dates = new Map<string, string>();
  const pattern =
    /publishedOn\\?":\\?"(\d{4}-\d{2}-\d{2})\\?"(?:(?!publishedOn|_id\\?":)[\s\S]){0,3000}?"?slug\\?":\{\\?"_type\\?":\\?"slug\\?",\\?"current\\?":\\?"([a-z0-9-]+)/g;
  for (const m of html.matchAll(pattern))
    if (!dates.has(m[2])) dates.set(m[2], `${m[1]}T12:00:00.000Z`);
  return dates;
}

export function htmlItems(source: ResearchSource & { type: "html" }, html: string) {
  const cards = parseCards(html, source.url, source.cards);
  const dates = source.provider === "anthropic" ? anthropicDates(html) : null;
  return cards.slice(0, MAX_PER_SOURCE).map(card =>
    item(source, "post", {
      title: card.title,
      link: card.link,
      summary: card.summary,
      // Anthropic prints each date above its card, where the card reader would take the next card's.
      publishedAt: dates
        ? (dates.get(new URL(card.link).pathname.split("/").pop()!) ?? null)
        : card.publishedAt,
    })
  );
}

export function feedResearchItems(source: ResearchSource & { type: "feed" }, xml: string) {
  const wanted = source.categories?.map(c => c.toLowerCase());
  const skipped = source.skipCategories?.map(c => c.toLowerCase());
  return parseFeed(xml)
    .filter(entry => {
      const categories = entry.categories.map(c => c.toLowerCase());
      if (wanted && !categories.some(c => wanted.includes(c))) return false;
      return !skipped || !categories.some(c => skipped.includes(c));
    })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, MAX_PER_SOURCE)
    .map(entry =>
      item(source, "post", {
        title: entry.title,
        link: entry.link,
        summary: entry.summary,
        publishedAt: entry.publishedAt,
      })
    );
}

type HfPaperHit = {
  paper?: {
    id?: string;
    title?: string;
    summary?: string;
    ai_summary?: string;
    upvotes?: number;
    publishedAt?: string;
    organization?: { name?: string };
  };
  organization?: { name?: string };
};

export function hfPaperItems(source: ResearchSource & { type: "hf-papers" }, hits: HfPaperHit[]) {
  const orgs = source.orgs.map(o => o.toLowerCase());
  return hits
    .filter(hit => {
      const org = hit.paper?.organization?.name ?? hit.organization?.name ?? "";
      return hit.paper?.id && hit.paper.title && orgs.includes(org.toLowerCase());
    })
    .map(({ paper }) => {
      const time = Date.parse(paper!.publishedAt ?? "");
      return item(source, "paper", {
        title: paper!.title!.replace(/\s+/g, " ").trim(),
        link: `https://huggingface.co/papers/${paper!.id}`,
        summary: truncate((paper!.ai_summary || paper!.summary || "").replace(/\s+/g, " ").trim()),
        publishedAt: Number.isFinite(time) ? new Date(time).toISOString() : null,
        upvotes: paper!.upvotes ?? 0,
      });
    })
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, MAX_PER_SOURCE);
}

type HfModelRaw = { id?: string; likes?: number; pipeline_tag?: string; createdAt?: string };

export function hfModelItems(source: ResearchSource, models: HfModelRaw[]) {
  return models
    .filter(m => m.id && m.createdAt)
    .slice(0, MAX_WEIGHTS)
    .map(m =>
      item(source, "weights", {
        title: m.id!,
        link: `https://huggingface.co/${m.id}`,
        summary: m.pipeline_tag ?? "",
        publishedAt: new Date(Date.parse(m.createdAt!)).toISOString(),
        upvotes: m.likes ?? 0,
      })
    );
}

/** Newest news page in the DeepSeek docs sitemap: "news261017" (2026-10-17) beats "news1226" (2024). */
export function latestDeepseekPage(sitemap: string) {
  const slugs = [...sitemap.matchAll(/\/news\/(news(\d{4}|\d{6}))</g)].map(m => ({
    slug: m[1],
    key: m[2].length === 4 ? `24${m[2]}` : m[2],
  }));
  const latest = slugs.sort((a, b) => b.key.localeCompare(a.key))[0];
  return latest ? `https://api-docs.deepseek.com/news/${latest.slug}` : null;
}

/** Menu links of a DeepSeek news page: "DeepSeek-V3.2 Release 2025/12/01". */
export function deepseekItems(source: ResearchSource, html: string) {
  const items = new Map<string, ResearchItem>();
  for (const m of html.matchAll(
    /<a\b[^>]*href="\/news\/(news\d+)"[^>]*>([^<]+?)\s+(\d{4})\/(\d{2})\/(\d{2})\s*<\/a>/g
  )) {
    const link = `https://api-docs.deepseek.com/news/${m[1]}`;
    if (items.has(link)) continue;
    items.set(
      link,
      item(source, "post", {
        title: decodeXml(m[2]),
        link,
        summary: "",
        publishedAt: `${m[3]}-${m[4]}-${m[5]}T12:00:00.000Z`,
      })
    );
  }
  return sortResearch([...items.values()]).slice(0, MAX_PER_SOURCE);
}

/** "**2026-08-26**", then the model name, then bullets, in the Markdown copy of the Z.ai release notes. */
export function zaiItems(source: ResearchSource, markdown: string) {
  const parts = markdown.split(/^\*\*(\d{4}-\d{2}-\d{2})\*\*\s*$/m);
  const items: ResearchItem[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const date = parts[i];
    const lines = parts[i + 1].split("\n").map(l => l.trim()).filter(Boolean);
    const title = lines.find(l => !l.startsWith("*") && !l.startsWith("#"));
    if (!title) continue;
    const bullet = lines.find(l => l.startsWith("* "));
    const doc = parts[i + 1].match(/\]\((https:\/\/docs\.z\.ai\/[^)\s]+?)(?:\.md)?\)/)?.[1];
    items.push(
      item(source, "post", {
        title,
        link: safeLink(doc ?? "") || `https://docs.z.ai/release-notes/new-released#${date}`,
        summary: bullet
          ? truncate(bullet.slice(2).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\\\*|\*/g, "").trim())
          : "",
        publishedAt: `${date}T12:00:00.000Z`,
      })
    );
  }
  return items.slice(0, MAX_PER_SOURCE);
}

async function collectSource(source: ResearchSource) {
  switch (source.type) {
    case "html": {
      const { body, latencyMs } = await fetchText(source.url, 30_000);
      return { items: htmlItems(source, body), latencyMs };
    }
    case "feed": {
      const { body, latencyMs } = await fetchText(source.url, 30_000);
      return { items: feedResearchItems(source, body), latencyMs };
    }
    case "hf-papers": {
      const { body, latencyMs } = await fetchJson<HfPaperHit[]>(source.url);
      return { items: hfPaperItems(source, Array.isArray(body) ? body : []), latencyMs };
    }
    case "hf-models": {
      const { body, latencyMs } = await fetchJson<HfModelRaw[]>(source.url);
      return { items: hfModelItems(source, Array.isArray(body) ? body : []), latencyMs };
    }
    case "deepseek-news": {
      const sitemap = await fetchText(source.url);
      const page = latestDeepseekPage(sitemap.body);
      if (!page) throw new Error("nenhuma página de notícias no sitemap");
      const { body, latencyMs } = await fetchText(page);
      return { items: deepseekItems(source, body), latencyMs: sitemap.latencyMs + latencyMs };
    }
    case "zai-notes": {
      const { body, latencyMs } = await fetchText(source.url);
      return { items: zaiItems(source, body), latencyMs };
    }
  }
}

async function attempt(source: ResearchSource) {
  const started = Date.now();
  try {
    const { items, latencyMs } = await collectSource(source);
    return {
      items,
      status: sourceStatus(source, { ok: true, latencyMs, itemCount: items.length }),
    };
  } catch (error) {
    return {
      items: null,
      status: sourceStatus(source, {
        ok: false,
        latencyMs: Date.now() - started,
        message: errorMessage(error),
      }),
    };
  }
}

/** One area per provider; a source that failed or came back empty keeps the items it gave last time. */
export function buildProviders(
  results: { source: ResearchSource; items: ResearchItem[] | null }[],
  previous: ResearchProvider[] = []
): ResearchProvider[] {
  const before = previous.flatMap(p => p.items);
  return RESEARCH_PROVIDERS.map(provider => {
    const own = results.filter(r => r.source.provider === provider.id);
    const items = own.flatMap(({ source, items }) =>
      items?.length ? items : before.filter(i => i.sourceId === source.id)
    );
    const seen = new Set<string>();
    return {
      ...provider,
      sourceIds: own.map(r => r.source.id),
      items: sortResearch(items)
        .filter(i => !seen.has(i.link) && seen.add(i.link))
        .slice(0, MAX_PER_PROVIDER),
    };
  });
}

const CACHE_NAME = "research";

async function build(previous: ResearchResponse | null): Promise<ResearchResponse> {
  const results = await Promise.all(
    RESEARCH_SOURCES.map(async source => ({ source, ...(await attempt(source)) }))
  );
  const sources: SourceStatus[] = results.map(r => r.status);
  const value: ResearchResponse = {
    updatedAt: new Date().toISOString(),
    // A lab with no paper this month leaves its Hugging Face search empty; only errors make the page partial.
    status: overallStatus(
      sources.map(s => (s.status === "empty" ? { ...s, status: "ok" } : s))
    ),
    sources,
    providers: buildProviders(results, previous?.providers),
  };
  writeCache(CACHE_NAME, value);
  return value;
}

export const researchCollector = createCollector<ResearchResponse>({
  name: "research",
  intervalMs: RESEARCH_INTERVAL_MS,
  retryMs: 5 * 60_000,
  build,
  initial: readCache<ResearchResponse>(CACHE_NAME),
  log: v =>
    logLine(
      "pesquisa",
      v.status,
      `${v.providers.reduce((n, p) => n + p.items.length, 0)} itens de ${v.providers.length} provedores`,
      v.sources
    ),
});

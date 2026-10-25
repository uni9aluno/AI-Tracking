import type { Paper, PapersResponse, SourceStatus } from "../../shared/types";
import {
  createCollector,
  logLine,
  overallStatus,
  sourceStatus,
} from "../lib/collector";
import { decodeXml, safeLink, tag, truncate } from "../lib/feed";
import { errorMessage, fetchJson, fetchText } from "../lib/http";
import { readCache, writeCache } from "../store";

const ARXIV = {
  id: "arxiv",
  label: "arXiv (cs.AI, cs.CL, cs.LG, cs.CV)",
  // arXiv asks for at most one call every 3 s; one call per round is far below that.
  url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG+OR+cat:cs.CV&sortBy=submittedDate&sortOrder=descending&max_results=60",
};
const HF_PAPERS = {
  id: "hf-papers",
  label: "Hugging Face Daily Papers",
  url: "https://huggingface.co/api/daily_papers",
};
export const AREA_LABEL: Record<string, string> = {
  "cs.AI": "IA",
  "cs.CL": "Linguagem",
  "cs.LG": "Aprendizado de máquina",
  "cs.CV": "Visão computacional",
};
// arXiv publishes once a day; 10 min keeps the HF votes fresh without pressing either API.
export const PAPERS_INTERVAL_MS = 10 * 60_000;

export function parseArxiv(xml: string): Paper[] {
  const blocks = xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const papers: Paper[] = [];
  for (const block of blocks) {
    const abs = safeLink(tag(block, "id"));
    const title = tag(block, "title");
    const published = Date.parse(tag(block, "published"));
    if (!abs || !title || !Number.isFinite(published)) continue;
    const id = abs.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
    const pdf = block.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"|<link[^>]*href="([^"]+)"[^>]*title="pdf"/i);
    papers.push({
      id,
      title,
      summary: truncate(tag(block, "summary"), 420),
      authors: [...block.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/gi)].map(m =>
        decodeXml(m[1])
      ),
      link: `https://arxiv.org/abs/${id}`,
      pdf: safeLink(pdf?.[1] ?? pdf?.[2] ?? "") || null,
      categories: [
        ...new Set(
          [...block.matchAll(/<category[^>]*term="([^"]+)"/gi)].map(m => m[1])
        ),
      ],
      publishedAt: new Date(published).toISOString(),
      source: "arxiv",
    });
  }
  return papers;
}

type HfDailyPaper = {
  paper: {
    id: string;
    title: string;
    summary?: string;
    ai_summary?: string;
    upvotes?: number;
    publishedAt?: string;
    githubRepo?: string | null;
    authors?: { name?: string }[];
  };
  publishedAt?: string;
};

export function parseHfPapers(data: HfDailyPaper[]): Paper[] {
  return data
    .filter(d => d?.paper?.id && d.paper.title)
    .map(({ paper, publishedAt }) => ({
      id: paper.id,
      title: paper.title.replace(/\s+/g, " ").trim(),
      // The HF one-liner is shorter and easier to scan than the abstract.
      summary: truncate(
        (paper.ai_summary || paper.summary || "").replace(/\s+/g, " ").trim(),
        420
      ),
      authors: (paper.authors ?? []).map(a => a.name ?? "").filter(Boolean),
      link: `https://huggingface.co/papers/${paper.id}`,
      pdf: /^\d{4}\.\d{4,5}$/.test(paper.id)
        ? `https://arxiv.org/pdf/${paper.id}`
        : null,
      categories: [],
      publishedAt: new Date(
        Date.parse(paper.publishedAt ?? publishedAt ?? "") || Date.now()
      ).toISOString(),
      upvotes: paper.upvotes ?? 0,
      githubRepo: paper.githubRepo ? safeLink(paper.githubRepo) || null : null,
      source: "hf" as const,
    }))
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
}

async function attempt<T>(
  base: { id: string; label: string; url: string },
  run: () => Promise<{ items: T[]; latencyMs: number }>
): Promise<{ status: SourceStatus; items: T[] | null }> {
  const started = Date.now();
  try {
    const { items, latencyMs } = await run();
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

const CACHE_NAME = "papers";

// arXiv answers 429 to frequent callers and only publishes once a day, so it is asked every 30 min.
const ARXIV_EVERY_MS = 30 * 60_000;

async function build(previous: PapersResponse | null): Promise<PapersResponse> {
  const lastArxiv = previous?.sources.find(s => s.id === ARXIV.id);
  const arxivFresh =
    lastArxiv?.status === "ok" &&
    Date.now() - Date.parse(lastArxiv.fetchedAt) < ARXIV_EVERY_MS;
  const [arxiv, hf] = await Promise.all([
    arxivFresh
      ? { status: lastArxiv, items: previous!.latest }
      : attempt(ARXIV, async () => {
          const { body, latencyMs } = await fetchText(ARXIV.url, 45_000);
          return { items: parseArxiv(body), latencyMs };
        }),
    attempt(HF_PAPERS, async () => {
      const { body, latencyMs } = await fetchJson<HfDailyPaper[]>(HF_PAPERS.url);
      return { items: parseHfPapers(Array.isArray(body) ? body : []), latencyMs };
    }),
  ]);
  const sources = [arxiv.status, hf.status];
  // A failed source keeps the last list it gave, instead of emptying the page.
  const value: PapersResponse = {
    updatedAt: new Date().toISOString(),
    status: overallStatus(sources),
    sources,
    latest: arxiv.items?.length ? arxiv.items : (previous?.latest ?? []),
    trending: hf.items?.length ? hf.items : (previous?.trending ?? []),
  };
  writeCache(CACHE_NAME, value);
  return value;
}

export const papersCollector = createCollector<PapersResponse>({
  name: "papers",
  intervalMs: PAPERS_INTERVAL_MS,
  retryMs: 3 * 60_000,
  build,
  initial: readCache<PapersResponse>(CACHE_NAME),
  log: v =>
    logLine(
      "artigos",
      v.status,
      `${v.latest.length} arXiv, ${v.trending.length} em alta`,
      v.sources
    ),
});

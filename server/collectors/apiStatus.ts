import type {
  ApiIndicator,
  ApiService,
  ApiStatusResponse,
} from "../../shared/types";
import {
  createCollector,
  logLine,
  overallStatus,
  sourceStatus,
} from "../lib/collector";
import { errorMessage, fetchJson } from "../lib/http";
import { readCache, writeCache } from "../store";

export const API_STATUS_INTERVAL_MS = 5 * 60_000;

// Statuspage-compatible pages (/api/v2/summary.json). DeepSeek and Hugging Face have none; Mistral answers 403 to servers.
export const STATUS_PAGES = [
  { id: "openai", label: "OpenAI", url: "https://status.openai.com" },
  { id: "anthropic", label: "Anthropic", url: "https://status.anthropic.com" },
  { id: "github", label: "GitHub (Copilot)", url: "https://www.githubstatus.com" },
  { id: "cohere", label: "Cohere", url: "https://status.cohere.com" },
  { id: "perplexity", label: "Perplexity", url: "https://status.perplexity.com" },
];

type Summary = {
  status?: { indicator?: string; description?: string };
  incidents?: {
    name: string;
    impact?: string;
    status?: string;
    updated_at?: string;
    shortlink?: string;
  }[];
  components?: { name: string; status: string; group?: boolean }[];
};

const INDICATORS = new Set<ApiIndicator>(["none", "minor", "major", "critical", "maintenance"]);

export function parseSummary(
  page: { id: string; label: string; url: string },
  data: Summary
): ApiService {
  const indicator = (data.status?.indicator ?? "unknown") as ApiIndicator;
  return {
    id: page.id,
    label: page.label,
    url: page.url,
    indicator: INDICATORS.has(indicator) ? indicator : "unknown",
    description: data.status?.description ?? "Sem descrição",
    incidents: (data.incidents ?? [])
      .filter(i => i.status !== "resolved" && i.status !== "postmortem")
      .map(i => ({
        name: i.name,
        impact: i.impact ?? "none",
        updatedAt: i.updated_at ?? "",
        url: i.shortlink ?? page.url,
      })),
    degraded: (data.components ?? [])
      .filter(c => !c.group && c.status !== "operational")
      .map(c => c.name)
      .slice(0, 8),
  };
}

const CACHE_NAME = "api-status";

async function build(): Promise<ApiStatusResponse> {
  const results = await Promise.all(
    STATUS_PAGES.map(async page => {
      const started = Date.now();
      const base = { id: `status-${page.id}`, label: page.label, url: page.url };
      try {
        const { body, latencyMs } = await fetchJson<Summary>(
          `${page.url}/api/v2/summary.json`,
          10_000
        );
        return {
          service: parseSummary(page, body),
          status: sourceStatus(base, { ok: true, latencyMs, itemCount: 1 }),
        };
      } catch (error) {
        const message = errorMessage(error);
        return {
          service: {
            ...page,
            indicator: "unknown" as const,
            description: `Página de status não respondeu (${message})`,
            incidents: [],
            degraded: [],
          },
          status: sourceStatus(base, {
            ok: false,
            latencyMs: Date.now() - started,
            message,
          }),
        };
      }
    })
  );
  const sources = results.map(r => r.status);
  const value: ApiStatusResponse = {
    updatedAt: new Date().toISOString(),
    status: overallStatus(sources),
    sources,
    services: results.map(r => r.service),
  };
  writeCache(CACHE_NAME, value);
  return value;
}

export const apiStatusCollector = createCollector<ApiStatusResponse>({
  name: "api-status",
  intervalMs: API_STATUS_INTERVAL_MS,
  build,
  initial: readCache<ApiStatusResponse>(CACHE_NAME),
  log: v => {
    const problems = v.services.filter(s => s.indicator !== "none").map(s => `${s.id}=${s.indicator}`);
    return logLine("status-apis", v.status, problems.length ? problems.join(", ") : "todas operando", v.sources);
  },
});

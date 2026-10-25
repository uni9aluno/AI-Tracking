import type { FeedStatus, SourceStatus } from "../../shared/types";

// A forced refresh bypasses the cache at most this often, so repeated clicks cannot hammer the sources.
const MIN_FORCED_REFRESH_MS = 15_000;

export type Collector<T> = {
  name: string;
  intervalMs: number;
  /** Cached value while fresh; otherwise one collection shared by every caller. */
  get(force?: boolean): Promise<T>;
  /** Last value, without collecting. */
  peek(): T | null;
};

/**
 * Cache + in-flight promise (pattern of the Radar Eleitoral's live.ts and polls/service.ts).
 * A degraded answer is retried after `retryMs`, so a brief outage does not stick for a whole interval.
 */
export function createCollector<T extends { status: FeedStatus }>(options: {
  name: string;
  intervalMs: number;
  retryMs?: number;
  build: (previous: T | null) => Promise<T>;
  log?: (value: T) => string;
  /** Value restored from disk; it counts as stale, so the first get() collects. */
  initial?: T | null;
}): Collector<T> {
  let cache: { createdAt: number; value: T } | null = options.initial
    ? { createdAt: 0, value: options.initial }
    : null;
  let inFlight: Promise<T> | null = null;
  const ttl = (value: T) =>
    value.status === "live"
      ? options.intervalMs
      : Math.min(options.intervalMs, options.retryMs ?? 60_000);

  return {
    name: options.name,
    intervalMs: options.intervalMs,
    peek: () => cache?.value ?? null,
    get(force = false) {
      const age = cache ? Date.now() - cache.createdAt : Infinity;
      const fresh = cache && age < ttl(cache.value);
      if (fresh && !(force && age >= MIN_FORCED_REFRESH_MS))
        return Promise.resolve(cache!.value);
      if (!inFlight) {
        inFlight = options
          .build(cache?.value ?? null)
          .then(value => {
            cache = { createdAt: Date.now(), value };
            if (options.log) console.log(options.log(value));
            return value;
          })
          .finally(() => {
            inFlight = null;
          });
      }
      return inFlight;
    },
  };
}

/** "live" only when every source answered with items. */
export const overallStatus = (sources: SourceStatus[]): FeedStatus =>
  sources.every(s => s.status === "ok") ? "live" : "degraded";

export function sourceStatus(
  base: { id: string; label: string; url: string },
  result:
    | { ok: true; latencyMs: number; itemCount: number }
    | { ok: false; latencyMs: number; message: string }
): SourceStatus {
  const common = {
    id: base.id,
    label: base.label,
    url: base.url,
    fetchedAt: new Date().toISOString(),
    latencyMs: result.latencyMs,
  };
  return result.ok
    ? {
        ...common,
        status: result.itemCount > 0 ? "ok" : "empty",
        itemCount: result.itemCount,
      }
    : { ...common, status: "error", message: result.message };
}

/** "id(status: message)" for every source that is not ok, for the log lines. */
export const failingSources = (sources: SourceStatus[]) =>
  sources
    .filter(s => s.status !== "ok")
    .map(s => `${s.id}(${s.status}${s.message ? `: ${s.message}` : ""})`);

export const logLine = (
  tag: string,
  status: FeedStatus,
  summary: string,
  sources: SourceStatus[]
) => {
  const failing = failingSources(sources);
  return `[${tag}] ${status} · ${summary} · ${failing.length ? `com problema: ${failing.join(", ")}` : "todas as fontes ok"}`;
};

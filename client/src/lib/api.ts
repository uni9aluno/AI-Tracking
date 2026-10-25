import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApiStatusResponse,
  BenchmarksResponse,
  Guide,
  ModelsResponse,
  NewsResponse,
  Overview,
  PapersResponse,
  TrendingResponse,
} from "@shared/types";

/** The server collects every 5 min; the browser asks just as often. */
export const POLL_MS = 5 * 60_000;

async function fetchJson<T>(path: string, force: boolean) {
  const response = await fetch(`${path}${force ? "?refresh=1" : ""}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

// Every component calling the same hook shares one cached query, one request and one polling timer.
function useApi<T>(path: string, pollMs = POLL_MS) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [path],
    queryFn: () => fetchJson<T>(path, false),
    refetchInterval: pollMs,
    staleTime: 60_000,
  });
  // A forced fetch writes into the same query, so its loading and error states reach every reader.
  const refresh = () => {
    void queryClient
      .fetchQuery({
        queryKey: [path],
        queryFn: () => fetchJson<T>(path, true),
        staleTime: 0,
      })
      .catch(() => undefined);
  };
  return {
    data: query.data ?? null,
    loading: query.isFetching,
    error: query.error
      ? query.error instanceof Error
        ? query.error.message
        : "Não foi possível atualizar"
      : null,
    refresh,
  };
}

export const useOverview = () => useApi<Overview>("/api/overview");
export const useNews = () => useApi<NewsResponse>("/api/news");
export const useModels = () => useApi<ModelsResponse>("/api/models");
export const usePapers = () => useApi<PapersResponse>("/api/papers");
export const useTrending = () => useApi<TrendingResponse>("/api/trending");
export const useBenchmarks = () =>
  useApi<BenchmarksResponse>("/api/benchmarks");
export const useApiStatus = () => useApi<ApiStatusResponse>("/api/api-status");
export const useGuide = () => useApi<Guide>("/api/guide", 60 * 60_000);

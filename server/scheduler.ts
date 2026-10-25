import { apiStatusCollector } from "./collectors/apiStatus";
import { benchmarksCollector } from "./collectors/benchmarks";
import { modelsCollector } from "./collectors/models";
import { newsCollector } from "./collectors/news";
import { papersCollector } from "./collectors/papers";
import { trendingCollector } from "./collectors/trending";

export const COLLECTORS = {
  news: newsCollector,
  models: modelsCollector,
  papers: papersCollector,
  trending: trendingCollector,
  benchmarks: benchmarksCollector,
  apiStatus: apiStatusCollector,
};

// Collections start a few seconds apart, so a restart does not fire every source at once.
const STAGGER_MS = 4_000;

/** Collect in the background on each collector's own interval (5 min for news, models and status). */
export function startScheduler() {
  Object.values(COLLECTORS).forEach((collector, index) => {
    const run = () =>
      collector.get(true).catch(error =>
        console.error(`[agendador] ${collector.name}:`, error)
      );
    setTimeout(() => {
      void run();
      setInterval(run, collector.intervalMs).unref();
    }, index * STAGGER_MS).unref();
  });
}

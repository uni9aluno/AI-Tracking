import type { NewsItem } from "./types";

/**
 * How much a story stands out: each extra outlet that carried it counts double, Hacker News points add at
 * most 2 (one per 250). A story alone in one feed weighs 1.
 */
export const storyWeight = (item: NewsItem) =>
  1 + item.alsoIn.length * 2 + Math.min(2, Math.floor((item.score ?? 0) / 250));

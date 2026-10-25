import { useSyncExternalStore } from "react";
import type { NewsItem, Paper } from "@shared/types";

/**
 * Favorites and "read" marks live only in this browser (localStorage). Every access is guarded: private
 * windows and blocked storage make it throw, and the page must still work.
 */
export type SavedEntry = {
  id: string;
  kind: "noticia" | "artigo" | "modelo";
  title: string;
  link: string;
  source: string;
  date: string;
  savedAt: string;
};

const SAVED_KEY = "radar-ia:salvos";
const READ_KEY = "radar-ia:lidos";
const MAX_READ = 3000;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the mark lasts only for this visit.
  }
}

let saved: SavedEntry[] = load(SAVED_KEY, []);
let read = new Set<string>(load<string[]>(READ_KEY, []));
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach(l => l());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Another tab changed the lists.
if (typeof window !== "undefined")
  window.addEventListener("storage", event => {
    if (event.key === SAVED_KEY) saved = load(SAVED_KEY, []);
    else if (event.key === READ_KEY) read = new Set(load<string[]>(READ_KEY, []));
    else return;
    emit();
  });

export function toggleSaved(entry: Omit<SavedEntry, "savedAt">) {
  saved = saved.some(s => s.id === entry.id)
    ? saved.filter(s => s.id !== entry.id)
    : [{ ...entry, savedAt: new Date().toISOString() }, ...saved];
  store(SAVED_KEY, saved);
  emit();
}
export function removeSaved(id: string) {
  saved = saved.filter(s => s.id !== id);
  store(SAVED_KEY, saved);
  emit();
}
export function markRead(id: string, value = true) {
  if (value === read.has(id)) return;
  if (value) read.add(id);
  else read.delete(id);
  store(READ_KEY, [...read].slice(-MAX_READ));
  emit();
}

/** Re-renders whenever either list changes. */
export function useSaved() {
  useSyncExternalStore(subscribe, () => version);
  return {
    saved,
    isSaved: (id: string) => saved.some(s => s.id === id),
    isRead: (id: string) => read.has(id),
  };
}

export const newsEntry = (item: NewsItem): Omit<SavedEntry, "savedAt"> => ({
  id: `n:${item.id}`,
  kind: "noticia",
  title: item.title,
  link: item.link,
  source: item.source,
  date: item.publishedAt,
});
export const paperEntry = (paper: Paper): Omit<SavedEntry, "savedAt"> => ({
  id: `a:${paper.id}`,
  kind: "artigo",
  title: paper.title,
  link: paper.link,
  source: paper.source === "hf" ? "Hugging Face Papers" : "arXiv",
  date: paper.publishedAt,
});

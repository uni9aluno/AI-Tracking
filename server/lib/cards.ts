/**
 * Listing pages without a feed (Anthropic Research, xAI News, Manus Blog...): each post is a link whose card
 * carries a heading and a date. Regex-based, like feed.ts; the pages are few and well known.
 */
import { decodeNumericEntities, decodeXml, truncate } from "./feed";

export type Card = {
  title: string;
  link: string;
  summary: string;
  /** ISO date, or null when the page shows none. */
  publishedAt: string | null;
};

export type CardOptions = {
  /** Path of a post, as a regex without anchors ("/research/[a-z0-9-]+"). A trailing slash is optional. */
  path: string;
  /** Paths matching `path` that are not posts ("/research/team/.*"). */
  exclude?: string;
  /**
   * "after" (default): the link wraps the card, or the card text follows it.
   * "before": the card ends with a "Read the paper" link, so the text sits before it.
   */
  cardAt?: "after" | "before";
};

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const MONTH = String.raw`(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?`;
const DATE_PATTERNS: [RegExp, (m: RegExpMatchArray) => [number, number, number]][] = [
  [/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/, m => [+m[1], +m[2] - 1, +m[3]]],
  [
    new RegExp(String.raw`\b${MONTH} (\d{1,2}),? (\d{4})\b`, "i"),
    m => [+m[3], MONTHS.indexOf(m[1].toLowerCase()), +m[2]],
  ],
  [
    new RegExp(String.raw`\b(\d{1,2}) ${MONTH},? (\d{4})\b`, "i"),
    m => [+m[3], MONTHS.indexOf(m[2].toLowerCase()), +m[1]],
  ],
];
// Labels of "more" links; such a link is not a card on its own.
const JUNK =
  /^(read|learn|see|view|discover|explore)( the)? (more|paper|post|story|article|all)\b|^(featured|more|new|blog|news|research)$/i;
const MAX_CARD = 5_000;

// Tags become spaces, so "Science</span><span>Sep 17, 2026" keeps its words apart.
const text = (html: string) =>
  decodeNumericEntities(decodeXml(html.replace(/<[^>]+>/g, " ")));

/** First date written in the text, at noon UTC so it never shifts a day. Returns the match too. */
export function looseDate(text: string): { iso: string; match: string } | null {
  let best: { index: number; iso: string; match: string } | null = null;
  for (const [pattern, parts] of DATE_PATTERNS) {
    const m = text.match(pattern);
    if (!m || m.index === undefined || (best && best.index <= m.index)) continue;
    const [year, month, day] = parts(m);
    const time = Date.UTC(year, month, day, 12);
    const date = new Date(time);
    if (month < 0 || date.getUTCDate() !== day || year < 2000) continue;
    best = { index: m.index, iso: date.toISOString(), match: m[0] };
  }
  return best && { iso: best.iso, match: best.match };
}

function isoAttr(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00.000Z`;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function cardDate(html: string) {
  const attr = html.match(/datetime\s*=\s*["']([^"']+)["']/i);
  const fromAttr = attr ? isoAttr(attr[1]) : null;
  return fromAttr ?? looseDate(text(html))?.iso ?? null;
}

const headings = (html: string) =>
  [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map(m => text(m[1]))
    .filter(Boolean);

const attr = (attrs: string, name: string) =>
  attrs.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";

function cleanTitle(value: string) {
  const date = looseDate(value);
  const title = (date ? value.replace(date.match, "") : value)
    .replace(/\s+/g, " ")
    .trim()
    // Meta prefixes every card link with a screen-reader "Read".
    .replace(/^Read (?=[A-Z].{12})/, "");
  return title.length >= 4 && !JUNK.test(title) ? truncate(title, 200) : "";
}

function cardSummary(html: string, title: string) {
  for (const m of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const value = text(m[1]);
    if (value.length >= 40 && value !== title) return truncate(value);
  }
  return "";
}

export function parseCards(
  html: string,
  baseUrl: string,
  options: CardOptions
): Card[] {
  const page = html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, " ");
  const base = new URL(baseUrl);
  const wanted = new RegExp(`^(?:${options.path})/?$`, "i");
  const excluded = options.exclude
    ? new RegExp(`^(?:${options.exclude})/?$`, "i")
    : null;
  const anchors: { path: string; attrs: string; inner: string; start: number; end: number }[] = [];
  for (const m of page.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = decodeXml(attr(m[1], "href"));
    // "#main" links ("Skip to main content") resolve to the page itself.
    if (!href || href.startsWith("#")) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, ""))
      continue;
    const path = url.pathname.replace(/\/+$/, "");
    if (!wanted.test(path) || excluded?.test(path)) continue;
    anchors.push({ path, attrs: m[1], inner: m[2], start: m.index!, end: m.index! + m[0].length });
  }

  const cards = new Map<string, Card>();
  anchors.forEach((anchor, i) => {
    const after = options.cardAt !== "before";
    let segment: string;
    if (after) {
      const next = anchors.slice(i + 1).find(a => a.path !== anchor.path);
      segment = page.slice(anchor.start, Math.min(next?.start ?? Infinity, anchor.start + MAX_CARD));
    } else {
      const previous = anchors.slice(0, i).reverse().find(a => a.path !== anchor.path);
      segment = page.slice(Math.max(previous?.end ?? 0, anchor.end - MAX_CARD), anchor.end);
    }
    const title = [
      ...headings(anchor.inner),
      text(anchor.inner),
      text(attr(anchor.attrs, "aria-label")),
      // A "Read the paper" link closes its card, so the card's longest heading is the title.
      ...(after ? [] : headings(segment).sort((a, b) => b.length - a.length)),
    ]
      .map(cleanTitle)
      .find(Boolean);
    // Without its own title the link is a "Learn more" button: the text after it belongs to the next card.
    if (!title) return;
    const card: Card = {
      title,
      link: new URL(anchor.path, base).href,
      summary: cardSummary(segment, title),
      publishedAt: (after && cardDate(anchor.inner)) || cardDate(segment),
    };
    const known = cards.get(card.link);
    if (!known) cards.set(card.link, card);
    else {
      // The same post often appears twice (menu, carousel, list); keep what each copy adds.
      known.publishedAt ??= card.publishedAt;
      known.summary ||= card.summary;
    }
  });
  return [...cards.values()];
}

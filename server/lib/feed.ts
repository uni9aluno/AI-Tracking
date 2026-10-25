/** RSS 2.0 and Atom reader, regex-based (the feeds are few and well known). Extracted from the Radar Eleitoral. */

export type FeedEntry = {
  title: string;
  link: string;
  summary: string;
  publishedAt: string;
  categories: string[];
  /** Raw description, for sources that keep numbers there (Hacker News points). */
  rawDescription: string;
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};
const SUMMARY_MAX = 280;

function decodeEntities(value: string) {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code[0] !== "#") return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
      const point =
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : entity;
    }
  );
}

const stripCdata = (value: string) =>
  value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

// Single pass, so "&amp;lt;" becomes "&lt;" instead of being decoded twice.
export function decodeXml(value: string) {
  return decodeEntities(stripCdata(value).replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

// Some feeds escape titles twice: "&amp;#8220;" survives one pass as "&#8220;".
// Only numeric entities get the second pass, so "&amp;lt;" keeps its single decode.
export function decodeNumericEntities(value: string) {
  return value.replace(/&#(x[0-9a-f]+|\d+);/gi, (entity, code: string) => {
    const point =
      code[0].toLowerCase() === "x"
        ? parseInt(code.slice(1), 16)
        : parseInt(code, 10);
    return point > 0 && point <= 0x10ffff
      ? String.fromCodePoint(point)
      : entity;
  });
}

/**
 * Escaped HTML inside a description (Reddit, WordPress) becomes plain text: one decode for the XML layer,
 * tags out, then one more for the HTML layer. The result is only ever rendered as text.
 */
export function plainText(value: string) {
  const html = decodeEntities(stripCdata(value).replace(/<[^>]+>/g, " "));
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\[link\]|\[comments\]|submitted by\s+\/u\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function raw(block: string, name: string) {
  const match = block.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")
  );
  return match ? match[1] : "";
}

export function tag(block: string, name: string) {
  return decodeXml(raw(block, name));
}

export function safeLink(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

const attr = (attrs: string, name: string) =>
  attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";

function atomLink(block: string) {
  const links = [...block.matchAll(/<link\b([^>]*)>/gi)].map(m => m[1]);
  const alternate =
    links.find(a => /rel\s*=\s*["']alternate["']/i.test(a)) ??
    links.find(a => !/rel\s*=/i.test(a)) ??
    links[0];
  return alternate ? decodeEntities(attr(alternate, "href")) : "";
}

export function truncate(value: string, max = SUMMARY_MAX) {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—–-]+$/, "")}…`;
}

function isoDate(value: string) {
  const time = Date.parse(value.trim());
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

export function parseFeed(xml: string): FeedEntry[] {
  const atom = !/<item[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks =
    xml.match(
      atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi
    ) ?? [];
  const entries: FeedEntry[] = [];
  for (const block of blocks) {
    const title = decodeNumericEntities(tag(block, "title"));
    const link = safeLink(
      atom ? atomLink(block) : tag(block, "link") || tag(block, "guid")
    );
    const publishedAt = isoDate(
      tag(block, "pubDate") ||
        tag(block, "published") ||
        tag(block, "updated") ||
        tag(block, "dc:date")
    );
    if (!title || !link || !publishedAt) continue;
    const rawDescription =
      raw(block, "description") ||
      raw(block, "summary") ||
      raw(block, "content");
    const categories = [
      ...[...block.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map(
        m => decodeXml(m[1])
      ),
      ...[...block.matchAll(/<category\b([^>]*)\/>/gi)].map(m =>
        decodeEntities(attr(m[1], "term"))
      ),
    ].filter(Boolean);
    entries.push({
      title,
      link,
      summary: truncate(plainText(rawDescription)),
      publishedAt,
      categories,
      rawDescription,
    });
  }
  return entries;
}

/** Accent-free, lower-case; keeps dots and hyphens inside words ("gpt-5.1", "llama.cpp"). */
export function normalizedText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/g, " ")
    .replace(/(?<![a-z0-9])[.-]+|[.-]+(?![a-z0-9])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IGNORED = new Set(
  (
    "a as o os um uma e de da do das dos em no na nos nas para por com que se ao aos " +
    "the of to in on for and is are with its it at by from as an how why what new"
  ).split(" ")
);

/** Key for spotting the same story across sources: first 12 meaningful words. */
export function dedupeKey(title: string) {
  return normalizedText(title)
    .split(" ")
    .filter(word => word.length > 2 && !IGNORED.has(word))
    .slice(0, 12)
    .join(" ");
}

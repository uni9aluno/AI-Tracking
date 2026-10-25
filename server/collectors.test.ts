import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { NewsItem } from "../shared/types";
import { parseSummary } from "./collectors/apiStatus";
import { parseArena } from "./collectors/benchmarks";
import { parseOpenRouter } from "./collectors/models";
import { feedItems, mergeNews, NEWS_FEEDS } from "./collectors/news";
import { parseArxiv, parseHfPapers } from "./collectors/papers";
import { parseGithub, parseHub } from "./collectors/trending";
import { createCollector } from "./lib/collector";
import { parseFeed } from "./lib/feed";
import { highlights } from "./overview";

const text = (name: string) =>
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");
const json = (name: string) => JSON.parse(text(name));
const NOW = Date.parse("2026-10-25T12:00:00Z");
const feed = (id: string) => NEWS_FEEDS.find(f => f.id === id)!;

describe("notícias", () => {
  it("classifica os posts oficiais com a empresa do blog", () => {
    const items = feedItems(feed("openai"), parseFeed(text("openai.xml")), NOW);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.companies).toContain("openai");
      expect(item.topics).toContain("novidades");
      expect(item.kind).toBe("laboratorio");
    }
  });

  it("filtra o Tecnoblog (feed geral) só para IA", () => {
    const entries = parseFeed(text("tecnoblog.xml"));
    const items = feedItems(feed("tecnoblog"), entries, NOW);
    expect(items.length).toBeLessThanOrEqual(entries.length);
    expect(items.every(i => i.lang === "pt")).toBe(true);
  });

  it("lê os pontos do Hacker News e ignora o resumo vazio", () => {
    const items = feedItems(feed("hn"), parseFeed(text("hn.xml")), NOW);
    expect(items[0].score).toBeGreaterThanOrEqual(100);
    expect(items[0].summary).toBe("");
  });

  it("separa o veículo do título no Google Notícias", () => {
    const xml = `<rss><channel><item><title>Anthropic raises new round at huge valuation - Reuters</title>
      <link>https://news.google.com/rss/articles/abc</link><pubDate>Sun, 25 Oct 2026 10:00:00 GMT</pubDate>
      <description>&lt;a href="x"&gt;links&lt;/a&gt;</description></item></channel></rss>`;
    const [item] = feedItems(feed("gnews-labs"), parseFeed(xml), NOW);
    expect(item.title).toBe("Anthropic raises new round at huge valuation");
    expect(item.source).toBe("Reuters");
    expect(item.companies).toContain("anthropic");
    expect(item.topics).toContain("negocios");
  });

  it("junta a mesma história de fontes diferentes e descarta o que passou de 7 dias", () => {
    const base = (over: Partial<NewsItem>): NewsItem => ({
      id: "x",
      title: "OpenAI launches GPT-6",
      link: "https://a.com/1",
      summary: "",
      source: "The Verge",
      sourceId: "verge",
      kind: "imprensa",
      lang: "en",
      publishedAt: "2026-10-25T10:00:00Z",
      topics: ["novos-modelos"],
      companies: ["openai"],
      models: ["gpt"],
      alsoIn: [],
      ...over,
    });
    const merged = mergeNews(
      [base({ id: "old", link: "https://a.com/old", publishedAt: "2026-10-10T10:00:00Z", title: "Old story" })],
      [
        base({ id: "a" }),
        base({ id: "b", link: "https://b.com/1", source: "TechCrunch", sourceId: "techcrunch", title: "OpenAI Launches GPT-6!", publishedAt: "2026-10-25T11:00:00Z" }),
        base({ id: "c", link: "https://a.com/1" }),
      ],
      NOW
    );
    expect(merged.map(m => m.id)).toEqual(["a"]);
    expect(merged[0].alsoIn).toEqual(["TechCrunch"]);
    expect(highlights(merged, NOW)).toHaveLength(1);
  });
});

describe("artigos", () => {
  it("lê a API do arXiv", () => {
    const papers = parseArxiv(text("arxiv.xml"));
    expect(papers.length).toBe(6);
    const p = papers[0];
    expect(p.id).toMatch(/^\d{4}\.\d{5}$/);
    expect(p.link).toBe(`https://arxiv.org/abs/${p.id}`);
    expect(p.pdf).toMatch(/^https:\/\/arxiv\.org\/pdf\//);
    expect(p.authors.length).toBeGreaterThan(0);
    expect(p.categories.length).toBeGreaterThan(0);
  });
  it("lê os Daily Papers do Hugging Face, por votos", () => {
    const papers = parseHfPapers(json("hf-papers.json"));
    expect(papers.length).toBe(4);
    expect(papers[0].link).toMatch(/^https:\/\/huggingface\.co\/papers\//);
    expect(papers[0].upvotes!).toBeGreaterThanOrEqual(papers[1].upvotes!);
  });
});

describe("modelos", () => {
  it("converte preço por token em US$ por milhão e lê o índice de inteligência", () => {
    const models = parseOpenRouter(json("openrouter.json"));
    const kimi = models.find(m => m.id === "moonshotai/kimi-k3.1-pro")!;
    expect(kimi.name).toBe("Kimi K3.1 Pro");
    expect(kimi.providerLabel).toBe("Moonshot (Kimi)");
    expect(kimi.inputPrice).toBe(2);
    expect(kimi.outputPrice).toBe(10);
    expect(kimi.intelligenceIndex).toBe(55.1);
    expect(kimi.tools).toBe(true);
    expect(kimi.inputModalities).toContain("image");
    expect(models.find(m => m.id.endsWith(":free"))!.free).toBe(true);
  });
  it("preço variável (roteadores) vira nulo, não negativo", () => {
    const routers = parseOpenRouter(json("openrouter.json")).filter(
      m => m.inputPrice === null
    );
    for (const m of routers) expect(m.outputPrice).toBeNull();
  });
});

describe("em alta, benchmarks e status", () => {
  it("lê GitHub e Hugging Face", () => {
    const repos = parseGithub(json("github.json"));
    expect(repos[0].url).toMatch(/^https:\/\/github\.com\//);
    expect(repos[0].stars).toBeGreaterThan(0);
    const models = parseHub(json("hf-models.json"), "model");
    expect(models[0].url).toBe(`https://huggingface.co/${models[0].id}`);
    const spaces = parseHub(json("hf-spaces.json"), "space");
    expect(spaces[0].url).toMatch(/^https:\/\/huggingface\.co\/spaces\//);
  });
  it("lê o placar da LMArena só na categoria geral", () => {
    const parsed = parseArena({
      rows: [
        { row: { model_name: "B", organization: "x", license: "MIT", rating: 1400.4, rating_lower: 1390, rating_upper: 1410, vote_count: 900, rank: 2, category: "overall", leaderboard_publish_date: "2026-10-22" } },
        { row: { model_name: "A", organization: "y", license: "Proprietary", rating: 1500.6, rank: 1, category: "overall", leaderboard_publish_date: "2026-10-22" } },
        { row: { model_name: "C", rating: 1600, rank: 1, category: "3d_modeling" } },
      ],
    });
    expect(parsed.rows.map(r => r.model)).toEqual(["A", "B"]);
    expect(parsed.rows[0].rating).toBe(1501);
    expect(parsed.metric).toBe("elo");
    expect(parsed.publishedAt).toBe("2026-10-22");
  });
  it("lê o placar de agentes, que usa score em vez de Elo", () => {
    const parsed = parseArena({
      rows: [
        { row: { model_name: "A", score: 0.2077, score_ci_lower: 0.1839, score_ci_upper: 0.2315, session_count: 12057, rank: 1, category: "overall" } },
      ],
    });
    expect(parsed.metric).toBe("share");
    expect(parsed.rows[0]).toMatchObject({ rating: 20.8, lower: 18.4, upper: 23.2, votes: 12057 });
  });
  it("lê a página de status (Statuspage)", () => {
    const s = parseSummary(
      { id: "openai", label: "OpenAI", url: "https://status.openai.com" },
      json("status-openai.json")
    );
    expect(s.indicator).toBe("none");
    expect(s.description).toBe("All Systems Operational");
    expect(s.incidents).toEqual([]);
  });
});

describe("createCollector", () => {
  it("compartilha uma coleta entre chamadas simultâneas e respeita o cache", async () => {
    const build = vi.fn(async () => ({ status: "live" as const, n: Math.random() }));
    const c = createCollector({ name: "t", intervalMs: 60_000, build });
    const [a, b] = await Promise.all([c.get(), c.get()]);
    expect(a).toBe(b);
    expect(await c.get()).toBe(a);
    expect(build).toHaveBeenCalledTimes(1);
    // Forced refresh right after a collection is ignored (minimum 15 s).
    expect(await c.get(true)).toBe(a);
  });
  it("coleta de novo quando o valor veio do disco", async () => {
    const build = vi.fn(async () => ({ status: "live" as const, n: 2 }));
    const c = createCollector({ name: "t", intervalMs: 60_000, build, initial: { status: "live", n: 1 } });
    expect(c.peek()?.n).toBe(1);
    expect((await c.get()).n).toBe(2);
  });
});

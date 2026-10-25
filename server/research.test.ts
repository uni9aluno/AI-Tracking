import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ResearchItem } from "../shared/types";
import {
  anthropicDates,
  buildProviders,
  deepseekItems,
  feedResearchItems,
  hfModelItems,
  hfPaperItems,
  htmlItems,
  latestDeepseekPage,
  RESEARCH_PROVIDERS,
  RESEARCH_SOURCES,
  sortResearch,
  zaiItems,
  type ResearchSource,
} from "./collectors/research";
import { looseDate, parseCards } from "./lib/cards";

const text = (name: string) =>
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");
const source = <T extends ResearchSource["type"]>(id: string) =>
  RESEARCH_SOURCES.find(s => s.id === id) as ResearchSource & { type: T };
const day = (item: { publishedAt: string | null }) =>
  item.publishedAt?.slice(0, 10) ?? null;

describe("datas soltas", () => {
  it("lê os formatos das páginas e fixa meio-dia UTC", () => {
    expect(looseDate("Product · Oct 22, 2026")?.iso).toBe("2026-10-22T12:00:00.000Z");
    expect(looseDate("October 1, 2026")?.iso).toBe("2026-10-01T12:00:00.000Z");
    expect(looseDate("New API Features 2024/07/25")?.match).toBe("2024/07/25");
    expect(looseDate("published 14 Oct 2026")?.iso).toBe("2026-10-14T12:00:00.000Z");
    expect(looseDate("Feb 30, 2026")).toBeNull();
    expect(looseDate("no date here")).toBeNull();
  });
});

describe("cartões HTML", () => {
  it("Anthropic: título, resumo e a data exata dos dados da página", () => {
    const items = htmlItems(source<"html">("anthropic-research"), text("research-anthropic.html"));
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.every(i => i.link.startsWith("https://www.anthropic.com/research/"))).toBe(true);
    expect(items.some(i => i.link.includes("/research/team/"))).toBe(false);
    const swap = items.find(i => i.link.endsWith("/project-swap"))!;
    expect(swap.title).toBe("Project Swap: What happens when agents trade for us?");
    // The date printed after this card belongs to the next one; the page data says 24/09.
    expect(day(swap)).toBe("2026-09-24");
    expect(day(items.find(i => i.link.endsWith("/redesigning-source-control"))!)).toBe("2026-10-13");
    expect(swap.summary).toMatch(/miniature market of Claudes/);
  });

  it("Anthropic: datas por slug a partir dos dados do Next.js", () => {
    const dates = anthropicDates(
      String.raw`{\"publishedOn\":\"2026-08-10\",\"sensitive\":null,\"seoDescription\":\"x\",\"slug\":{\"_type\":\"slug\",\"current\":\"riemann-zeta\"}`
    );
    expect(dates.get("riemann-zeta")).toBe("2026-08-10T12:00:00.000Z");
  });

  it("xAI: o link envolve o cartão com categoria e data", () => {
    const items = htmlItems(source<"html">("xai-news"), text("research-xai.html"));
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.every(i => i.publishedAt)).toBe(true);
    expect(items.find(i => i.link === "https://x.ai/news/incident-sweep")?.title).toBe(
      "Using Grok Bot to detect and respond to incidents"
    );
  });

  it("Manus: ignora as páginas de categoria e normaliza http para o endereço da fonte", () => {
    const items = htmlItems(source<"html">("manus-blog"), text("research-manus.html"));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.link.startsWith("https://manus.im/blog/"))).toBe(true);
    expect(items.some(i => /\/blog\/(product|customer-stories)$/.test(i.link))).toBe(false);
    expect(items.every(i => i.publishedAt)).toBe(true);
  });

  it("Meta: o texto do cartão fica antes do link “Read the Paper”", () => {
    const items = htmlItems(source<"html">("meta-publications"), text("research-meta-publications.html"));
    expect(items.length).toBe(3);
    const glimmer = items.find(i => i.link.includes("muse-glimmer"))!;
    expect(glimmer.title).toBe("Muse Glimmer 30B: An On-Device Agentic Model");
    expect(day(glimmer)).toBe("2026-10-19");
  });

  it("Meta Blog: “Learn More” não vira título nem leva a data do cartão seguinte", () => {
    const items = htmlItems(source<"html">("meta-blog"), text("research-meta-blog.html"));
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.title).not.toMatch(/^(Learn More|FEATURED|Read )/i);
      expect(item.publishedAt).not.toBeNull();
    }
    expect(day(items.find(i => i.link.includes("brain2qwerty"))!)).toBe("2026-06-29");
  });

  it("Kimi: título do aria-label e data ao lado do cartão", () => {
    const items = htmlItems(source<"html">("kimi-blog"), text("research-kimi.html"));
    const k3 = items.find(i => i.link === "https://www.kimi.com/en/blog/kimi-k3")!;
    expect(k3.title).toBe("Kimi K3");
    expect(day(k3)).toBe("2026-07-16");
  });

  it("DeepSeek: o menu da última notícia lista todas, com a data tirada do título", () => {
    const items = deepseekItems(source("deepseek-news"), text("research-deepseek.html"));
    expect(items.length).toBeGreaterThan(10);
    expect(items[0]).toMatchObject({
      title: "DeepSeek-V4.1-Flash-1017 Release",
      publishedAt: "2026-10-17T12:00:00.000Z",
    });
    const v3 = items.find(i => i.link.endsWith("/news/news1226"))!;
    expect(v3.title).toBe("Introducing DeepSeek-V3");
    expect(day(v3)).toBe("2024-12-26");
    expect(items.some(i => /English|Skip/.test(i.title))).toBe(false);
  });

  it("DeepSeek: escolhe a notícia mais nova do sitemap (6 dígitos vencem os de 2024)", () => {
    const sitemap = ["news0725", "news1226", "news260910", "news261017", "news250120"]
      .map(s => `<loc>https://api-docs.deepseek.com/news/${s}</loc>`)
      .join("");
    expect(latestDeepseekPage(sitemap)).toBe("https://api-docs.deepseek.com/news/news261017");
    expect(latestDeepseekPage("<urlset/>")).toBeNull();
  });
});

describe("feeds, Hugging Face e Z.ai", () => {
  it("OpenAI: só posts de pesquisa", () => {
    const xml = `<rss><channel>
      <item><title>Sharing AI progress in mathematics</title><link>https://openai.com/index/math/</link><pubDate>Tue, 06 Oct 2026 10:00:00 GMT</pubDate><category><![CDATA[Research]]></category></item>
      <item><title>New office in Lisbon</title><link>https://openai.com/index/lisbon/</link><pubDate>Wed, 07 Oct 2026 10:00:00 GMT</pubDate><category><![CDATA[Company]]></category></item>
    </channel></rss>`;
    const items = feedResearchItems(source<"feed">("openai-research"), xml);
    expect(items.map(i => i.title)).toEqual(["Sharing AI progress in mathematics"]);
    expect(items[0].kind).toBe("post");
  });

  it("ElevenLabs: tira guias e casos de clientes", () => {
    const items = feedResearchItems(source<"feed">("elevenlabs-blog"), text("research-elevenlabs.xml"));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(8);
  });

  it("artigos do Hugging Face: só os reivindicados pela organização do laboratório", () => {
    const hits = JSON.parse(text("hf-papers-search.json"));
    const items = hfPaperItems(source<"hf-papers">("hf-papers-qwen"), hits);
    expect(items.length).toBe(5);
    expect(items.every(i => i.link.startsWith("https://huggingface.co/papers/"))).toBe(true);
    expect(items.every(i => i.kind === "paper")).toBe(true);
    const days = items.map(day);
    expect([...days].sort().reverse()).toEqual(days);
  });

  it("pesos abertos do Hugging Face", () => {
    const items = hfModelItems(source("hf-models-qwen"), [
      { id: "Qwen/Qwen-Image-2.1-Turbo", likes: 1047, pipeline_tag: "text-to-image", createdAt: "2026-10-09T04:50:01.000Z" },
      { id: "Qwen/sem-data" },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "weights", upvotes: 1047, link: "https://huggingface.co/Qwen/Qwen-Image-2.1-Turbo" });
  });

  it("Z.ai: data, modelo, primeiro tópico e link da documentação", () => {
    const items = zaiItems(source("zai-notes"), text("research-zai.md"));
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0]).toMatchObject({
      title: "GLM-5.3-Flash",
      link: "https://docs.z.ai/guides/vlm/glm-5.3-flash",
      publishedAt: "2026-08-26T12:00:00.000Z",
    });
    expect(items[0].summary).toMatch(/^Native visual capabilities/);
  });
});

describe("áreas por provedor", () => {
  const post = (over: Partial<ResearchItem>): ResearchItem => ({
    id: "x",
    title: "t",
    link: "https://a.com/1",
    summary: "",
    publishedAt: "2026-10-01T12:00:00.000Z",
    kind: "post",
    sourceId: "anthropic-research",
    sourceLabel: "Anthropic Research",
    ...over,
  });

  it("tem os 12 provedores pedidos, cada um com fonte", () => {
    expect(RESEARCH_PROVIDERS.map(p => p.id)).toEqual([
      "anthropic", "openai", "google", "moonshot", "deepseek", "manus",
      "meta", "elevenlabs", "qwen", "glm", "copilot", "grok",
    ]);
    for (const provider of RESEARCH_PROVIDERS)
      expect(RESEARCH_SOURCES.some(s => s.provider === provider.id)).toBe(true);
  });

  it("itens sem data vão para o fim, na ordem da página", () => {
    const sorted = sortResearch([
      post({ link: "a", publishedAt: null }),
      post({ link: "b", publishedAt: "2026-09-01T12:00:00.000Z" }),
      post({ link: "c", publishedAt: null }),
      post({ link: "d", publishedAt: "2026-10-01T12:00:00.000Z" }),
    ]);
    expect(sorted.map(i => i.link)).toEqual(["d", "b", "a", "c"]);
  });

  it("fonte que falhou mantém os itens da coleta anterior", () => {
    const anthropic = source("anthropic-research");
    const old = post({ link: "https://www.anthropic.com/research/old" });
    const [first] = buildProviders([{ source: anthropic, items: null }], [
      { ...RESEARCH_PROVIDERS[0], sourceIds: [anthropic.id], items: [old] },
    ]);
    expect(first.items).toEqual([old]);
    const [fresh] = buildProviders([{ source: anthropic, items: [post({ link: "https://new" })] }]);
    expect(fresh.items.map(i => i.link)).toEqual(["https://new"]);
  });
});

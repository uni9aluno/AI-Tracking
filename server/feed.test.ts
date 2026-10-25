import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeXml,
  dedupeKey,
  normalizedText,
  parseFeed,
  plainText,
  safeLink,
  truncate,
} from "./lib/feed";

const fixture = (name: string) =>
  fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");

describe("parseFeed", () => {
  it("lê RSS 2.0 com CDATA (OpenAI)", () => {
    const entries = parseFeed(fixture("openai.xml"));
    expect(entries.length).toBe(6);
    expect(entries[0].title).toBe(
      "Rapidly scaling online storage to serve over 1 billion ChatGPT users (Part II)"
    );
    expect(entries[0].link).toBe(
      "https://openai.com/index/scaling-storage-one-billion-users-part-two"
    );
    expect(entries[0].publishedAt).toBe("2026-10-23T17:00:00.000Z");
    expect(entries[0].categories).toContain("Engineering");
    expect(entries[0].summary).toMatch(/^Learn how OpenAI scaled Habitat/);
  });

  it("lê Atom com link alternate e datas com fuso (The Verge)", () => {
    const entries = parseFeed(fixture("verge.xml"));
    expect(entries.length).toBe(5);
    expect(entries[0].title).toBe(
      "Blue Planet III is keeping the rough edges in the age of AI"
    );
    expect(entries[0].link).toMatch(/^https:\/\/www\.theverge\.com\/ai-artificial-intelligence\//);
    expect(entries[0].publishedAt).toBe("2026-10-24T21:29:12.000Z");
    expect(entries[0].categories).toContain("AI");
  });

  it("transforma o HTML escapado do Reddit em texto", () => {
    const entries = parseFeed(fixture("reddit.xml"));
    expect(entries.length).toBe(5);
    for (const e of entries) {
      expect(e.summary).not.toMatch(/<|&lt;|submitted by/);
      expect(e.link).toMatch(/^https:\/\/www\.reddit\.com\//);
    }
  });

  it("guarda a descrição crua (pontos do Hacker News)", () => {
    const entries = parseFeed(fixture("hn.xml"));
    expect(entries.length).toBe(6);
    expect(entries[0].rawDescription).toMatch(/Points:\s*\d+/);
  });

  it("descarta itens sem título, link http(s) ou data", () => {
    const xml = `<rss><channel>
      <item><title>ok</title><link>https://a.com/1</link><pubDate>Sat, 24 Oct 2026 10:00:00 GMT</pubDate></item>
      <item><title>js</title><link>javascript:alert(1)</link><pubDate>Sat, 24 Oct 2026 10:00:00 GMT</pubDate></item>
      <item><title>sem data</title><link>https://a.com/2</link></item>
      <item><title></title><link>https://a.com/3</link><pubDate>Sat, 24 Oct 2026 10:00:00 GMT</pubDate></item>
    </channel></rss>`;
    expect(parseFeed(xml).map(e => e.title)).toEqual(["ok"]);
  });
});

describe("texto", () => {
  it("decodifica entidades numa passada só", () => {
    expect(decodeXml("a &amp;lt; b &#8220;x&#8221;")).toBe("a &lt; b “x”");
    expect(plainText("&lt;p&gt;Olá &amp;amp; tchau&lt;/p&gt;")).toBe("Olá & tchau");
  });
  it("só aceita links http(s)", () => {
    expect(safeLink("https://x.com/a")).toBe("https://x.com/a");
    expect(safeLink("data:text/html,x")).toBe("");
  });
  it("corta resumo longo em fim de palavra", () => {
    const cut = truncate("palavra ".repeat(60), 50);
    expect(cut.length).toBeLessThanOrEqual(51);
    expect(cut.endsWith("palavra…")).toBe(true);
  });
  it("normaliza preservando versões de modelo", () => {
    expect(normalizedText("Lança o GPT-5.1 e o llama.cpp!")).toBe(
      "lanca o gpt-5.1 e o llama.cpp"
    );
  });
  it("gera a mesma chave para manchetes iguais com pontuação diferente", () => {
    expect(dedupeKey("OpenAI launches GPT-6: what's new")).toBe(
      dedupeKey("OpenAI Launches GPT-6 — What’s New?")
    );
  });
});

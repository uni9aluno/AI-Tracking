import { describe, expect, it } from "vitest";
import { classify, isAiRelated } from "./classify";

describe("classify", () => {
  it("reconhece lançamento de modelo pelo verbo + família", () => {
    const c = classify("Anthropic releases Claude Opus 6 with longer context", "");
    expect(c.topics[0]).toBe("novos-modelos");
    expect(c.companies).toContain("anthropic");
    expect(c.models).toContain("claude");
  });

  it("marca cibersegurança em inglês e português", () => {
    expect(
      classify("Kimi K3.1 removes cyberattack training data from open weight release", "").topics
    ).toEqual(expect.arrayContaining(["ciberseguranca", "open-source"]));
    expect(
      classify("Golpe usa deepfake de voz para roubar contas no WhatsApp", "").topics
    ).toContain("ciberseguranca");
    expect(classify("New prompt injection attack hits AI browsers", "").topics).toContain(
      "ciberseguranca"
    );
  });

  it("nome de família sem versão não é modelo novo", () => {
    const feature = classify("Claude Ships MCP Tasks and Elicitations in Claude Code", "");
    expect(feature.topics).not.toContain("novos-modelos");
    expect(feature.topics).toEqual(expect.arrayContaining(["agentes", "codigo"]));
    expect(classify("Google unveils Gemini 4 Flash", "").topics).toContain("novos-modelos");
    expect(classify("Alibaba lança Qwen3.5 com código aberto", "").topics).toContain("novos-modelos");
  });

  it("separa novas funções de novos modelos", () => {
    const c = classify("ChatGPT ganha novo recurso de memória para projetos", "");
    expect(c.topics).toContain("novas-funcoes");
    expect(c.topics).not.toContain("novos-modelos");
    expect(c.models).toContain("gpt");
  });

  it("dá vários tópicos ao mesmo item", () => {
    const c = classify(
      "Nvidia invests $2 billion in robotics startup building humanoid robots",
      ""
    );
    expect(c.topics).toEqual(
      expect.arrayContaining(["negocios", "robotica", "hardware"])
    );
    expect(c.companies).toContain("nvidia");
  });

  it("post oficial sempre leva 'novidades' e a empresa do blog", () => {
    const c = classify("Rapidly scaling online storage", "", {
      company: "openai",
      official: true,
    });
    expect(c.topics).toContain("novidades");
    expect(c.companies).toEqual(["openai"]);
  });

  it("nenhum item fica sem tópico", () => {
    expect(classify("Something unrelated happened", "").topics).toEqual([
      "novidades",
    ]);
  });

  it("não confunde palavras parecidas", () => {
    // "claudette" is not Claude, "meta" alone is Meta, "eu" is not the European Union.
    expect(classify("Claudette wins award", "").models).not.toContain("claude");
    expect(classify("Eu testei o novo app", "").topics).not.toContain("regulacao");
  });
});

describe("isAiRelated", () => {
  it("filtra feed geral pelo assunto", () => {
    expect(isAiRelated("Samsung lança celular com IA generativa", "pt")).toBe(true);
    expect(isAiRelated("Review do novo fone Bluetooth", "pt")).toBe(false);
    expect(isAiRelated("New AI chip from AMD", "en")).toBe(true);
  });
  it("em português, 'aí' não conta como AI", () => {
    expect(isAiRelated("E aí, vale a pena comprar?", "pt")).toBe(false);
  });
});

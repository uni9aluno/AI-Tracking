import type { Model, ModelsResponse } from "../../shared/types";
import {
  createCollector,
  logLine,
  overallStatus,
  sourceStatus,
} from "../lib/collector";
import { truncate } from "../lib/feed";
import { errorMessage, fetchJson } from "../lib/http";
import { readCache, writeCache } from "../store";

const OPENROUTER = {
  id: "openrouter",
  label: "OpenRouter (modelos e preços)",
  url: "https://openrouter.ai/api/v1/models",
};
export const MODELS_INTERVAL_MS = 5 * 60_000;

export const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "meta-llama": "Meta",
  meta: "Meta",
  "x-ai": "xAI",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
  qwen: "Alibaba (Qwen)",
  moonshotai: "Moonshot (Kimi)",
  nvidia: "NVIDIA",
  microsoft: "Microsoft",
  amazon: "Amazon",
  cohere: "Cohere",
  perplexity: "Perplexity",
  minimax: "MiniMax",
  "z-ai": "Zhipu (GLM)",
  thudm: "Zhipu (GLM)",
  baidu: "Baidu",
  tencent: "Tencent",
  bytedance: "ByteDance",
  "bytedance-seed": "ByteDance",
  ibm: "IBM",
  "ibm-granite": "IBM",
  inflection: "Inflection",
  ai21: "AI21",
  liquid: "Liquid AI",
  nousresearch: "Nous Research",
  openrouter: "OpenRouter",
  "arcee-ai": "Arcee",
  stepfun: "StepFun",
  xiaomi: "Xiaomi",
  inception: "Inception",
  allenai: "Ai2",
};

type OpenRouterModel = {
  id: string;
  name: string;
  created: number;
  description?: string;
  context_length?: number | null;
  hugging_face_id?: string | null;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  benchmarks?: {
    artificial_analysis?: {
      intelligence_index?: number | null;
      coding_index?: number | null;
      agentic_index?: number | null;
    };
  };
};

/** "0.000002" USD per token → 2 USD per million; negative means "varies" (routers). */
const perMillion = (value: string | undefined) => {
  const n = Number(value);
  if (value === undefined || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1e6 * 10_000) / 10_000;
};

export function parseOpenRouter(data: { data?: OpenRouterModel[] }): Model[] {
  return (data.data ?? [])
    .filter(m => m?.id && m.name && Number.isFinite(m.created))
    .map(m => {
      const provider = m.id.split("/")[0];
      const inputPrice = perMillion(m.pricing?.prompt);
      const outputPrice = perMillion(m.pricing?.completion);
      const params = m.supported_parameters ?? [];
      const aa = m.benchmarks?.artificial_analysis;
      return {
        id: m.id,
        // "Anthropic: Claude X" → "Claude X"; the provider has its own column.
        name: m.name.replace(/^[^:]{1,40}:\s*/, ""),
        provider,
        providerLabel: PROVIDER_LABEL[provider] ?? provider,
        description: truncate((m.description ?? "").replace(/\s+/g, " ").trim(), 320),
        createdAt: new Date(m.created * 1000).toISOString(),
        contextLength: m.context_length ?? null,
        inputPrice,
        outputPrice,
        free: m.id.endsWith(":free") || (inputPrice === 0 && outputPrice === 0),
        inputModalities: m.architecture?.input_modalities ?? ["text"],
        outputModalities: m.architecture?.output_modalities ?? ["text"],
        tools: params.includes("tools"),
        reasoning: params.includes("reasoning") || params.includes("include_reasoning"),
        openWeights: !!m.hugging_face_id,
        huggingFaceId: m.hugging_face_id || null,
        intelligenceIndex: aa?.intelligence_index ?? null,
        codingIndex: aa?.coding_index ?? null,
        agenticIndex: aa?.agentic_index ?? null,
        link: `https://openrouter.ai/${m.id.replace(/:free$/, "")}`,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const CACHE_NAME = "models";

async function build(previous: ModelsResponse | null): Promise<ModelsResponse> {
  const started = Date.now();
  try {
    const { body, latencyMs } = await fetchJson<{ data?: OpenRouterModel[] }>(
      OPENROUTER.url,
      25_000
    );
    const models = parseOpenRouter(body);
    const sources = [
      sourceStatus(OPENROUTER, { ok: true, latencyMs, itemCount: models.length }),
    ];
    const value: ModelsResponse = {
      updatedAt: new Date().toISOString(),
      status: overallStatus(sources),
      sources,
      models: models.length ? models : (previous?.models ?? []),
    };
    writeCache(CACHE_NAME, value);
    return value;
  } catch (error) {
    return {
      updatedAt: new Date().toISOString(),
      status: "degraded",
      sources: [
        sourceStatus(OPENROUTER, {
          ok: false,
          latencyMs: Date.now() - started,
          message: errorMessage(error),
        }),
      ],
      models: previous?.models ?? [],
    };
  }
}

export const modelsCollector = createCollector<ModelsResponse>({
  name: "models",
  intervalMs: MODELS_INTERVAL_MS,
  build,
  initial: readCache<ModelsResponse>(CACHE_NAME),
  log: v => {
    const week = v.models.filter(
      m => Date.now() - Date.parse(m.createdAt) < 7 * 86_400_000
    ).length;
    return logLine("modelos", v.status, `${v.models.length} modelos, ${week} novos em 7 dias`, v.sources);
  },
});

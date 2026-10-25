import type { Facet, Topic } from "../shared/types";
import { normalizedText } from "./lib/feed";

/**
 * Rule-based classification (no paid API). Each rule is matched against the accent-free title + summary:
 * - "word"       whole word ("claude")
 * - "pref*"      word start ("vulnerab*" covers vulnerability, vulnerabilidade)
 * - "two words"  phrase on word boundaries ("prompt injection")
 */
type Rules = string[];

export const TOPIC_RULES: Record<Exclude<Topic, "novidades">, Rules> = {
  "novos-modelos": [
    "new model*",
    "novo modelo",
    "novos modelos",
    "open-weight*",
    "open weight*",
    "model release",
    "frontier model",
    "lanca modelo",
    "lancou modelo",
    "model card",
    "system card",
    "flagship model",
  ],
  "novas-funcoes": [
    "feature*",
    "rolls out",
    "rolling out",
    "now available",
    "now lets",
    "now can",
    "adds",
    "added",
    "update*",
    "integration*",
    "plugin*",
    "extension*",
    "app",
    "apps",
    "api",
    "sdk",
    "mode",
    "launch*",
    "introduc*",
    "recurso*",
    "funcao",
    "funcoes",
    "funcionalidade*",
    "ganha",
    "atualizacao",
    "integracao",
    "chega",
    "libera",
    "disponivel",
    "modo",
  ],
  ciberseguranca: [
    "security",
    "cybersecurity",
    "cyber*",
    "ciber*",
    "vulnerab*",
    "exploit*",
    "malware",
    "ransomware",
    "phishing",
    "breach*",
    "hack*",
    "cve",
    "jailbreak*",
    "prompt injection",
    "deepfake*",
    "fraud*",
    "scam*",
    "zero-day",
    "backdoor*",
    "spyware",
    "data leak*",
    "seguranca digital",
    "ciberseguranca",
    "vazamento*",
    "golpe*",
    "ataque*",
    "invasao",
    "hacker*",
    "cyberattack*",
    "red team*",
  ],
  agentes: [
    "agent",
    "agents",
    "agentic",
    "agente*",
    "computer use",
    "mcp",
    "model context protocol",
    "operator",
    "autonomous",
    "autonomo*",
    "workflow*",
    "browser use",
    "assistente*",
  ],
  codigo: [
    "coding",
    "code",
    "coder",
    "developer*",
    "programming",
    "programac*",
    "programador*",
    "desenvolvedor*",
    "github copilot",
    "cursor",
    "ide",
    "github",
    "swe-bench",
    "codex",
    "claude code",
    "vibe coding",
    "devs",
    "software engineer*",
  ],
  "imagem-video": [
    "image*",
    "imagem",
    "imagens",
    "video*",
    "sora",
    "veo",
    "midjourney",
    "flux",
    "diffusion",
    "dall-e",
    "nano banana",
    "runway",
    "text-to-image",
    "text-to-video",
    "photo*",
    "foto*",
    "3d",
  ],
  "voz-audio": [
    "voice*",
    "audio",
    "speech",
    "music",
    "song",
    "songs",
    "tts",
    "text-to-speech",
    "transcri*",
    "voz",
    "vozes",
    "musica*",
    "podcast*",
    "elevenlabs",
    "whisper",
    "suno",
  ],
  "open-source": [
    "open source",
    "open-source",
    "open-weight*",
    "open weight*",
    "hugging face",
    "huggingface",
    "weights",
    "codigo aberto",
    "ollama",
    "llama.cpp",
    "gguf",
    "local llm*",
    "localllama",
    "apache 2.0",
    "mit license",
    "self-host*",
    "run locally",
  ],
  pesquisa: [
    "paper",
    "papers",
    "research*",
    "study",
    "studies",
    "arxiv",
    "benchmark*",
    "scientist*",
    "pesquisa*",
    "estudo*",
    "cientista*",
    "artigo cientifico",
    "breakthrough",
    "neurips",
    "icml",
    "iclr",
  ],
  negocios: [
    "funding",
    "raises",
    "raised",
    "valuation",
    "acqui*",
    "billion",
    "million",
    "investment*",
    "invest*",
    "ipo",
    "revenue",
    "deal",
    "partnership*",
    "layoff*",
    "startup*",
    "ceo",
    "stock*",
    "shares",
    "aquisicao",
    "bilhoes",
    "bilhao",
    "milhoes",
    "parceria*",
    "rodada",
    "receita",
    "demiss*",
    "acoes",
  ],
  regulacao: [
    "regulat*",
    "law",
    "laws",
    "lawsuit*",
    "sued",
    "sue",
    "suing",
    "sues",
    "court",
    "judge",
    "copyright",
    "ban",
    "bans",
    "banned",
    "ai act",
    "senate",
    "congress",
    "ftc",
    "doj",
    "policy",
    "legislat*",
    "antitrust",
    "regulac*",
    "lei",
    "leis",
    "projeto de lei",
    "processo",
    "processa",
    "justica",
    "tribunal",
    "stf",
    "anpd",
    "direitos autorais",
    "governo",
    "government",
    "white house",
    "uniao europeia",
  ],
  hardware: [
    "chip*",
    "gpu*",
    "tpu*",
    "nvidia",
    "data center*",
    "datacenter*",
    "data-center*",
    "semiconductor*",
    "blackwell",
    "rubin",
    "compute",
    "processador*",
    "servidor*",
    "energia",
    "power plant*",
    "nuclear",
    "tsmc",
    "amd",
    "cerebras",
    "groq",
  ],
  robotica: [
    "robot*",
    "robo",
    "robos",
    "robotic*",
    "humanoid*",
    "humanoide*",
    "self-driving",
    "autonomous vehicle*",
    "waymo",
    "tesla optimus",
    "optimus",
    "drone*",
  ],
  saude: [
    "health*",
    "medical",
    "medicine",
    "drug*",
    "clinical",
    "patient*",
    "doctor*",
    "hospital*",
    "cancer",
    "saude",
    "medic*",
    "paciente*",
    "doenca*",
    "biology",
    "protein*",
  ],
  educacao: [
    "education*",
    "student*",
    "school*",
    "teacher*",
    "university",
    "universities",
    "learning tool*",
    "educac*",
    "escola*",
    "aluno*",
    "estudante*",
    "professor*",
    "universidade*",
    "curso*",
  ],
  etica: [
    "ai safety",
    "safety",
    "alignment",
    "aligned",
    "bias",
    "ethic*",
    "misinformation",
    "disinformation",
    "superintelligence",
    "agi",
    "existential",
    "guardrail*",
    "seguranca da ia",
    "etica",
    "vies",
    "desinformacao",
    "alinhamento",
    "chatbot harm*",
    "mental health",
    "saude mental",
    "child safety",
    "privacy",
    "privacidade",
  ],
};

/** A launch verb plus a model mention is a model release, even without the word "model" in a rule. */
const LAUNCH_RULES: Rules = [
  "launch*",
  "release*",
  "unveil*",
  "introduc*",
  "announc*",
  "debut*",
  "ships",
  "lanca*",
  "lancou",
  "lancamento",
  "apresenta*",
  "anuncia*",
  "revela*",
];
const MODEL_WORDS: Rules = ["model", "models", "modelo", "modelos", "llm", "llms"];
// Family name followed, within two words, by a version number: "claude opus 6", "gpt-6", "qwen3".
const VERSIONED =
  / (?:gpt|claude|gemini|gemma|llama|grok|mistral|magistral|devstral|qwen|deepseek|kimi|glm|phi|muse|nemotron|veo|sora|flux|minimax|nova)(?:[\s-]?v?\d|[\s-](?:[a-z]+[\s-]){0,2}v?\d)/;

export type Company = { id: string; label: string; rules: Rules };

export const COMPANIES: Company[] = [
  { id: "openai", label: "OpenAI", rules: ["openai", "chatgpt", "gpt*", "sora", "codex", "altman", "dall-e", "o3", "o4"] },
  { id: "anthropic", label: "Anthropic", rules: ["anthropic", "claude", "claude-*", "amodei"] },
  { id: "google", label: "Google", rules: ["google", "gemini*", "deepmind", "gemma*", "veo", "notebooklm", "nano banana", "alphafold", "pichai", "hassabis", "tpu*"] },
  { id: "meta", label: "Meta", rules: ["meta", "llama*", "zuckerberg", "muse"] },
  { id: "microsoft", label: "Microsoft", rules: ["microsoft", "copilot", "azure", "bing", "nadella", "phi-*"] },
  { id: "xai", label: "xAI", rules: ["xai", "grok*"] },
  { id: "mistral", label: "Mistral", rules: ["mistral*", "mixtral", "codestral", "le chat"] },
  { id: "deepseek", label: "DeepSeek", rules: ["deepseek*"] },
  { id: "alibaba", label: "Alibaba (Qwen)", rules: ["alibaba", "qwen*"] },
  { id: "moonshot", label: "Moonshot (Kimi)", rules: ["moonshot", "kimi*"] },
  { id: "nvidia", label: "NVIDIA", rules: ["nvidia", "nemotron", "jensen huang", "cuda"] },
  { id: "apple", label: "Apple", rules: ["apple", "siri", "iphone"] },
  { id: "amazon", label: "Amazon", rules: ["amazon", "aws", "bedrock", "alexa*"] },
  { id: "huggingface", label: "Hugging Face", rules: ["hugging face", "huggingface"] },
  { id: "perplexity", label: "Perplexity", rules: ["perplexity"] },
  { id: "minimax", label: "MiniMax", rules: ["minimax"] },
  { id: "zhipu", label: "Zhipu (GLM)", rules: ["zhipu", "glm-*", "z.ai"] },
  { id: "cohere", label: "Cohere", rules: ["cohere"] },
  { id: "stability", label: "Stability AI", rules: ["stability ai", "stable diffusion"] },
  { id: "midjourney", label: "Midjourney", rules: ["midjourney"] },
  { id: "samsung", label: "Samsung", rules: ["samsung"] },
  { id: "ibm", label: "IBM", rules: ["ibm", "granite"] },
];

export const MODEL_FAMILIES: Company[] = [
  { id: "gpt", label: "GPT / ChatGPT", rules: ["gpt*", "chatgpt"] },
  { id: "claude", label: "Claude", rules: ["claude", "claude-*"] },
  { id: "gemini", label: "Gemini", rules: ["gemini*"] },
  { id: "gemma", label: "Gemma", rules: ["gemma*"] },
  { id: "llama", label: "Llama", rules: ["llama", "llama-*", "llama.*"] },
  { id: "muse", label: "Muse (Meta)", rules: ["muse"] },
  { id: "grok", label: "Grok", rules: ["grok*"] },
  { id: "mistral", label: "Mistral", rules: ["mistral*", "mixtral", "codestral", "magistral", "devstral"] },
  { id: "deepseek", label: "DeepSeek", rules: ["deepseek*"] },
  { id: "qwen", label: "Qwen", rules: ["qwen*"] },
  { id: "kimi", label: "Kimi", rules: ["kimi*"] },
  { id: "glm", label: "GLM", rules: ["glm", "glm-*"] },
  { id: "minimax", label: "MiniMax", rules: ["minimax*"] },
  { id: "phi", label: "Phi", rules: ["phi-*"] },
  { id: "copilot", label: "Copilot", rules: ["copilot"] },
  { id: "codex", label: "Codex", rules: ["codex"] },
  { id: "sora", label: "Sora", rules: ["sora"] },
  { id: "veo", label: "Veo", rules: ["veo", "veo-*"] },
  { id: "nova", label: "Amazon Nova", rules: ["amazon nova", "nova pro", "nova premier"] },
  { id: "nemotron", label: "Nemotron", rules: ["nemotron*"] },
  { id: "flux", label: "FLUX", rules: ["flux"] },
];

/** Signals for general-interest feeds: only AI stories are kept. */
const AI_RULES: Rules = [
  "ai",
  "a.i.",
  "ia",
  "ias",
  "inteligencia artificial",
  "artificial intelligence",
  "machine learning",
  "aprendizado de maquina",
  "deep learning",
  "neural",
  "llm*",
  "chatbot*",
  "generative",
  "generativa",
  "agentic",
  "openai",
  "anthropic",
  "deepmind",
  "chatgpt",
  "gpt*",
  "claude",
  "gemini",
  "copilot",
  "deepseek",
  "llama",
  "grok",
  "mistral",
  "qwen",
  "hugging face",
];

type Matcher = (text: Text) => boolean;
type Text = { words: string[]; padded: string };

function compile(rules: Rules): Matcher {
  const exact = new Set<string>();
  const prefixes: string[] = [];
  const phrases: string[] = [];
  for (const rule of rules) {
    const prefix = rule.endsWith("*");
    const body = prefix ? rule.slice(0, -1) : rule;
    // normalizedText drops a trailing hyphen, which "claude-*" needs to keep "claudette" out.
    const r = normalizedText(body) + (body.endsWith("-") ? "-" : "");
    if (r.includes(" ")) phrases.push(` ${r} `);
    else if (prefix) prefixes.push(r);
    else exact.add(r);
  }
  return text =>
    text.words.some(
      w => exact.has(w) || prefixes.some(p => w.startsWith(p))
    ) || phrases.some(p => text.padded.includes(p));
}

const toText = (value: string): Text => {
  const normalized = normalizedText(value);
  return { words: normalized.split(" "), padded: ` ${normalized} ` };
};

const topicMatchers = Object.entries(TOPIC_RULES).map(
  ([topic, rules]) => [topic as Topic, compile(rules)] as const
);
const launch = compile(LAUNCH_RULES);
const modelWord = compile(MODEL_WORDS);
const companyMatchers = COMPANIES.map(c => [c.id, compile(c.rules)] as const);
const familyMatchers = MODEL_FAMILIES.map(
  f => [f.id, compile(f.rules)] as const
);
const aiMatcher = compile(AI_RULES);
// In Portuguese "aí" normalizes to "ai"; there only "IA" and the longer rules count.
const aiMatcherPt = compile(AI_RULES.filter(rule => rule !== "ai"));

export const isAiRelated = (value: string, lang: "en" | "pt" = "en") =>
  (lang === "pt" ? aiMatcherPt : aiMatcher)(toText(value));

export type Classification = {
  topics: Topic[];
  companies: string[];
  models: string[];
};

/**
 * Topics come from the title plus the start of the summary; "novidades" marks every official lab post
 * and anything no other topic claimed, so no item is left without a topic.
 */
export function classify(
  title: string,
  summary: string,
  options: { company?: string; official?: boolean } = {}
): Classification {
  const text = toText(`${title} ${summary.slice(0, 220)}`);
  const titleText = toText(title);
  const companies = companyMatchers
    .filter(([, match]) => match(text))
    .map(([id]) => id);
  if (options.company && !companies.includes(options.company))
    companies.unshift(options.company);
  const models = familyMatchers.filter(([, match]) => match(text)).map(([id]) => id);
  const topics = topicMatchers
    .filter(([, match]) => match(text))
    .map(([topic]) => topic);
  // A launch verb in the title, plus a versioned family ("Gemini 4", "GPT-6") or the word "model", is a
  // new model. A bare family name is not: "Claude ships MCP tasks" is a feature.
  if (
    !topics.includes("novos-modelos") &&
    launch(titleText) &&
    (VERSIONED.test(titleText.padded) || modelWord(titleText))
  )
    topics.unshift("novos-modelos");
  if (options.official || topics.length === 0) topics.push("novidades");
  return { topics, companies, models };
}

export const companyFacets = (ids: Iterable<string>): Facet[] => {
  const set = new Set(ids);
  return COMPANIES.filter(c => set.has(c.id)).map(({ id, label }) => ({
    id,
    label,
  }));
};
export const modelFacets = (ids: Iterable<string>): Facet[] => {
  const set = new Set(ids);
  return MODEL_FAMILIES.filter(f => set.has(f.id)).map(({ id, label }) => ({
    id,
    label,
  }));
};

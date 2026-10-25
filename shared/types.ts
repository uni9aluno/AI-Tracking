/** Contracts shared by the server routes and the browser. */

export type SourceStatus = {
  id: string;
  label: string;
  url: string;
  /** "empty" means the source answered but carried no usable items. */
  status: "ok" | "empty" | "error";
  fetchedAt: string;
  latencyMs: number;
  itemCount?: number;
  message?: string;
};

export type FeedStatus = "live" | "degraded";

export const TOPICS = {
  "novos-modelos": "Novos modelos",
  "novas-funcoes": "Novas funções",
  novidades: "Novidades",
  ciberseguranca: "Cibersegurança",
  agentes: "Agentes",
  codigo: "Programação",
  "imagem-video": "Imagem e vídeo",
  "voz-audio": "Voz e áudio",
  "open-source": "Open source",
  pesquisa: "Pesquisa",
  negocios: "Negócios",
  regulacao: "Regulação e justiça",
  hardware: "Chips e infraestrutura",
  robotica: "Robótica",
  saude: "Saúde",
  educacao: "Educação",
  etica: "Segurança da IA e ética",
} as const;
export type Topic = keyof typeof TOPICS;

export type SourceKind = "laboratorio" | "imprensa" | "comunidade";
export const SOURCE_KIND_LABEL: Record<SourceKind, string> = {
  laboratorio: "Laboratórios",
  imprensa: "Imprensa",
  comunidade: "Comunidade",
};

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  source: string;
  sourceId: string;
  kind: SourceKind;
  lang: "en" | "pt";
  publishedAt: string;
  topics: Topic[];
  /** Company ids (see COMPANIES in server/classify.ts). */
  companies: string[];
  /** Model family ids (GPT, Claude, Gemini...). */
  models: string[];
  /** Hacker News points or Reddit-free score, when the source has one. */
  score?: number;
  /** Other sources that published the same story (by label). */
  alsoIn: string[];
};

export type Facet = { id: string; label: string };

export type NewsResponse = {
  updatedAt: string;
  status: FeedStatus;
  sources: SourceStatus[];
  items: NewsItem[];
  companies: Facet[];
  models: Facet[];
};

export type Paper = {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  link: string;
  pdf: string | null;
  categories: string[];
  publishedAt: string;
  upvotes?: number;
  githubRepo?: string | null;
  source: "arxiv" | "hf";
};

export type PapersResponse = {
  updatedAt: string;
  status: FeedStatus;
  sources: SourceStatus[];
  latest: Paper[];
  trending: Paper[];
};

export type Model = {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  description: string;
  createdAt: string;
  contextLength: number | null;
  /** USD per million tokens; null when the price varies (routers). */
  inputPrice: number | null;
  outputPrice: number | null;
  free: boolean;
  inputModalities: string[];
  outputModalities: string[];
  tools: boolean;
  reasoning: boolean;
  openWeights: boolean;
  huggingFaceId: string | null;
  /** Artificial Analysis indexes, as published by OpenRouter. */
  intelligenceIndex: number | null;
  codingIndex: number | null;
  agenticIndex: number | null;
  link: string;
};

export type ModelsResponse = {
  updatedAt: string;
  status: FeedStatus;
  sources: SourceStatus[];
  models: Model[];
};

export type Repo = {
  id: string;
  name: string;
  url: string;
  description: string;
  stars: number;
  language: string | null;
  createdAt: string;
  topics: string[];
};

export type HubItem = {
  id: string;
  url: string;
  likes: number;
  downloads: number | null;
  trendingScore: number;
  task: string | null;
  createdAt: string | null;
  kind: "model" | "space";
};

export type TrendingResponse = {
  updatedAt: string;
  status: FeedStatus;
  sources: SourceStatus[];
  repos: Repo[];
  hfModels: HubItem[];
  hfSpaces: HubItem[];
};

export type ArenaRow = {
  rank: number;
  model: string;
  organization: string;
  license: string;
  rating: number;
  lower: number;
  upper: number;
  votes: number;
};

export type ArenaBoard = {
  id: string;
  label: string;
  description: string;
  publishedAt: string | null;
  /** "elo": Arena rating (~1000–1600). "share": the agent board's score, as a percentage. */
  metric: "elo" | "share";
  rows: ArenaRow[];
};

export type BenchmarksResponse = {
  updatedAt: string;
  status: FeedStatus;
  sources: SourceStatus[];
  arenas: ArenaBoard[];
};

export type ApiIndicator =
  | "none"
  | "minor"
  | "major"
  | "critical"
  | "maintenance"
  | "unknown";

export type ApiService = {
  id: string;
  label: string;
  url: string;
  indicator: ApiIndicator;
  description: string;
  incidents: { name: string; impact: string; updatedAt: string; url: string }[];
  degraded: string[];
};

export type ApiStatusResponse = {
  updatedAt: string;
  status: FeedStatus;
  sources: SourceStatus[];
  services: ApiService[];
};

export type Overview = {
  updatedAt: string;
  highlights: NewsItem[];
  latest: NewsItem[];
  newModels: Model[];
  services: ApiService[];
  repos: Repo[];
  hfModels: HubItem[];
  papers: Paper[];
  arenaTop: { board: string; label: string; metric: ArenaBoard["metric"]; rows: ArenaRow[] }[];
  counts: { news24h: number; newModels7d: number; sources: number; failing: number };
  sources: SourceStatus[];
};

/** data/guia.json: needs mapped to live rankings, plus a few stable tips. */
export type GuideNeed = {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Where the live ranking comes from. */
  ranking:
    | { kind: "arena"; board: string }
    | {
        kind: "models";
        sort: "intelligence" | "coding" | "agentic" | "price" | "context";
        filter?: {
          free?: boolean;
          openWeights?: boolean;
          input?: string;
          output?: string;
          minIntelligence?: number;
        };
      };
  tips: { name: string; url: string; note: string; free: boolean }[];
};

export type Guide = { reviewedAt: string; needs: GuideNeed[] };

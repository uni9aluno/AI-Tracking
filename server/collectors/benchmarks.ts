import type {
  ArenaBoard,
  ArenaRow,
  BenchmarksResponse,
  SourceStatus,
} from "../../shared/types";
import {
  createCollector,
  logLine,
  overallStatus,
  sourceStatus,
} from "../lib/collector";
import { errorMessage, fetchJson } from "../lib/http";
import { readCache, writeCache } from "../store";

// LMArena publishes its leaderboard as an open dataset (CC BY 4.0) and refreshes it a few times a week.
export const BENCHMARKS_INTERVAL_MS = 60 * 60_000;
const DATASET = "lmarena-ai/leaderboard-dataset";
const ROWS = 30;

export const ARENA_BOARDS: { id: string; label: string; description: string }[] = [
  { id: "text_style_control", label: "Texto (geral)", description: "Conversa, escrita e raciocínio. Pessoas comparam duas respostas às cegas; com controle de estilo, respostas longas ou cheias de formatação não ganham pontos só por isso." },
  { id: "webdev", label: "Programação web", description: "Gerar sites e apps funcionando a partir de um pedido, avaliados por quem usou o resultado." },
  { id: "agent", label: "Agentes", description: "Tarefas de várias etapas com ferramentas (terminal, arquivos). A nota é a pontuação da LMArena para agentes (0 a 100%), não Elo." },
  { id: "vision", label: "Visão", description: "Perguntas sobre imagens enviadas pelo usuário: fotos, gráficos, prints." },
  { id: "document", label: "Documentos", description: "Leitura e resposta sobre PDFs e documentos longos." },
  { id: "search", label: "Busca na web", description: "Respostas com pesquisa na internet e citação de fontes." },
  { id: "text_to_image", label: "Gerar imagem", description: "Imagens criadas a partir de texto." },
  { id: "image_edit", label: "Editar imagem", description: "Alterações pedidas em uma imagem existente." },
  { id: "text_to_video", label: "Gerar vídeo", description: "Vídeos criados a partir de texto." },
  { id: "image_to_video", label: "Imagem para vídeo", description: "Animar uma imagem enviada." },
];

// /rows is served from a cache and answers far more reliably than /filter; the "latest" split lists the
// overall category first, so the first 100 rows hold its top 30.
const boardUrl = (config: string) =>
  `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(DATASET)}&config=${config}&split=latest&offset=0&length=100`;

async function fetchBoard(config: string) {
  try {
    return await fetchJson<DatasetRows>(boardUrl(config), 20_000);
  } catch {
    // The dataset server fails often and briefly; one more try after a pause.
    await new Promise(resolve => setTimeout(resolve, 3_000));
    return fetchJson<DatasetRows>(boardUrl(config), 20_000);
  }
}

type DatasetRows = {
  rows?: {
    row: {
      model_name?: string;
      organization?: string;
      license?: string;
      rating?: number;
      rating_lower?: number;
      rating_upper?: number;
      score?: number;
      score_ci_lower?: number;
      score_ci_upper?: number;
      vote_count?: number;
      session_count?: number;
      rank?: number;
      category?: string;
      leaderboard_publish_date?: string;
    };
  }[];
};

export function parseArena(data: DatasetRows): {
  rows: ArenaRow[];
  publishedAt: string | null;
  metric: "elo" | "share";
} {
  const all = (data.rows ?? []).map(r => r.row);
  // The agent board publishes a 0–1 "score" instead of an Elo "rating".
  const metric = all.some(r => Number.isFinite(r?.rating)) ? "elo" : "share";
  const value = (v: number | undefined) =>
    v === undefined
      ? NaN
      : metric === "elo"
        ? Math.round(v)
        : Math.round(v * 1000) / 10;
  const raw = all.filter(
    r =>
      r?.model_name &&
      (r.category ?? "overall") === "overall" &&
      Number.isFinite(metric === "elo" ? r.rating : r.score) &&
      Number.isFinite(r.rank)
  );
  return {
    metric,
    rows: raw
      .map(r => {
        const main = metric === "elo" ? r.rating : r.score;
        return {
          rank: r.rank!,
          model: r.model_name!,
          organization: r.organization ?? "",
          license: r.license ?? "",
          rating: value(main),
          lower: value((metric === "elo" ? r.rating_lower : r.score_ci_lower) ?? main),
          upper: value((metric === "elo" ? r.rating_upper : r.score_ci_upper) ?? main),
          votes: Math.round(r.vote_count ?? r.session_count ?? 0),
        };
      })
      .sort((a, b) => a.rank - b.rank || b.rating - a.rating),
    publishedAt:
      raw
        .map(r => r.leaderboard_publish_date ?? "")
        .sort()
        .at(-1) || null,
  };
}

const CACHE_NAME = "benchmarks";

async function build(previous: BenchmarksResponse | null): Promise<BenchmarksResponse> {
  const sources: SourceStatus[] = [];
  const arenas: ArenaBoard[] = [];
  // One at a time: the dataset server answers 500 when hit with ten parallel queries.
  for (const board of ARENA_BOARDS) {
    const base = {
      id: `arena-${board.id}`,
      label: `LMArena · ${board.label}`,
      url: `https://huggingface.co/datasets/${DATASET}`,
    };
    const started = Date.now();
    try {
      const { body, latencyMs } = await fetchBoard(board.id);
      const parsed = parseArena(body);
      parsed.rows = parsed.rows.slice(0, ROWS);
      sources.push(sourceStatus(base, { ok: true, latencyMs, itemCount: parsed.rows.length }));
      arenas.push({ ...board, ...parsed });
    } catch (error) {
      sources.push(
        sourceStatus(base, {
          ok: false,
          latencyMs: Date.now() - started,
          message: errorMessage(error),
        })
      );
      const old = previous?.arenas.find(a => a.id === board.id);
      if (old) arenas.push(old);
    }
  }
  const value: BenchmarksResponse = {
    updatedAt: new Date().toISOString(),
    status: overallStatus(sources),
    sources,
    arenas: arenas.filter(a => a.rows.length > 0),
  };
  writeCache(CACHE_NAME, value);
  return value;
}

export const benchmarksCollector = createCollector<BenchmarksResponse>({
  name: "benchmarks",
  intervalMs: BENCHMARKS_INTERVAL_MS,
  retryMs: 5 * 60_000,
  build,
  initial: readCache<BenchmarksResponse>(CACHE_NAME),
  log: v =>
    logLine(
      "benchmarks",
      v.status,
      `${v.arenas.length} placares, publicados em ${v.arenas[0]?.publishedAt ?? "—"}`,
      v.sources
    ),
});

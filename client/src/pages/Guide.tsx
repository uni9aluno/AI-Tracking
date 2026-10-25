import {
  Bot,
  Code2,
  Coins,
  Eye,
  FileText,
  Gift,
  Image,
  Laptop,
  Layers,
  MessageSquare,
  Mic,
  Search,
  Video,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { ArenaBoard, GuideNeed, Model } from "@shared/types";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/common";
import { useBenchmarks, useGuide, useModels } from "@/lib/api";
import { day, int, num, price, tokens } from "@/lib/fmt";

const ICONS: Record<string, LucideIcon> = {
  message: MessageSquare,
  code: Code2,
  bot: Bot,
  search: Search,
  file: FileText,
  eye: Eye,
  image: Image,
  wand: Wand2,
  video: Video,
  mic: Mic,
  laptop: Laptop,
  gift: Gift,
  coins: Coins,
  layers: Layers,
};
const TOP = 5;

type Row = { name: string; detail: string; value: string; link?: string };

function modelRanking(models: Model[], ranking: Extract<GuideNeed["ranking"], { kind: "models" }>): Row[] {
  const f = ranking.filter ?? {};
  const seen = new Set<string>();
  const list = models
    .filter(
      m =>
        (!f.free || m.free) &&
        (!f.openWeights || m.openWeights) &&
        (!f.input || m.inputModalities.includes(f.input)) &&
        (!f.output || m.outputModalities.includes(f.output)) &&
        (f.minIntelligence === undefined || (m.intelligenceIndex ?? -1) >= f.minIntelligence) &&
        (ranking.sort !== "price" || (m.inputPrice !== null && m.outputPrice !== null))
    )
    .sort((a, b) => {
      switch (ranking.sort) {
        case "price":
          return a.inputPrice! + a.outputPrice! - (b.inputPrice! + b.outputPrice!);
        case "context":
          return (b.contextLength ?? 0) - (a.contextLength ?? 0);
        case "coding":
          return (b.codingIndex ?? -1) - (a.codingIndex ?? -1);
        case "agentic":
          return (b.agenticIndex ?? -1) - (a.agenticIndex ?? -1);
        default:
          return (b.intelligenceIndex ?? -1) - (a.intelligenceIndex ?? -1);
      }
    })
    // One line per model: batch and :free variants share a name.
    .filter(m => {
      const key = m.name.replace(/\s*\((batch|free)\)\s*$/i, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, TOP);
  return list.map(m => ({
    name: m.name,
    detail: m.providerLabel,
    link: m.link,
    value:
      ranking.sort === "price"
        ? `${price(m.inputPrice)} + ${price(m.outputPrice)}`
        : ranking.sort === "context"
          ? tokens(m.contextLength)
          : m.intelligenceIndex !== null
            ? `índice ${num(m.intelligenceIndex, 1)}`
            : "sem índice",
  }));
}

function arenaRanking(board: ArenaBoard | undefined): Row[] {
  return (board?.rows ?? []).slice(0, TOP).map(r => ({
    name: r.model,
    detail: r.organization,
    value: board!.metric === "elo" ? `${int(r.rating)} Elo` : `${num(r.rating, 1)}%`,
  }));
}

function NeedCard({ need, boards, models }: { need: GuideNeed; boards: ArenaBoard[]; models: Model[] | null }) {
  const Icon = ICONS[need.icon] ?? Layers;
  const board = need.ranking.kind === "arena" ? boards.find(b => b.id === (need.ranking as { board: string }).board) : undefined;
  const rows =
    need.ranking.kind === "arena"
      ? arenaRanking(board)
      : models
        ? modelRanking(models, need.ranking)
        : [];
  const source =
    need.ranking.kind === "arena"
      ? `LMArena${board?.publishedAt ? `, placar de ${day(board.publishedAt)}` : ""}`
      : "OpenRouter + Artificial Analysis";
  return (
    <article className="card need-card" id={need.id}>
      <header className="need-head">
        <span className="need-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <div>
          <h2>{need.title}</h2>
          <p>{need.description}</p>
        </div>
      </header>
      <div>
        <p className="eyebrow">Melhores agora · {source}</p>
        {rows.length ? (
          <ol className="rank-list">
            {rows.map(r => (
              <li key={r.name}>
                <span>
                  {r.link ? (
                    <a href={r.link} target="_blank" rel="noreferrer">
                      {r.name}
                    </a>
                  ) : (
                    <b>{r.name}</b>
                  )}
                  <small>{r.detail}</small>
                </span>
                <span className="num muted">{r.value}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted small">Ranking indisponível no momento.</p>
        )}
      </div>
      {need.tips.length > 0 && (
        <div>
          <p className="eyebrow">Ferramentas para começar</p>
          <ul className="plain tip-list">
            {need.tips.map(t => (
              <li key={t.name}>
                <a href={t.url} target="_blank" rel="noreferrer">
                  {t.name}
                </a>
                {t.free && <span className="tag free">tem grátis</span>}
                <span className="muted"> {t.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

export default function Guide() {
  const guide = useGuide();
  const benchmarks = useBenchmarks();
  const models = useModels();
  const needs = guide.data?.needs ?? [];
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Qual IA usar"
        title="A ferramenta certa para cada necessidade"
        sub={
          <>
            Os rankings se atualizam sozinhos com os placares da LMArena e os índices da Artificial
            Analysis. As dicas de ferramentas foram revisadas em{" "}
            {guide.data ? day(guide.data.reviewedAt) : "—"}.
          </>
        }
      />
      {guide.error && !guide.data && <ErrorNotice error={guide.error} />}
      {!guide.data && guide.loading && <Loading />}
      {needs.length > 0 && (
        <nav className="filter-chips jump" aria-label="Ir para">
          {needs.map(n => (
            <a key={n.id} href={`#${n.id}`}>
              {n.title.split(/,| e /)[0]}
            </a>
          ))}
        </nav>
      )}
      {guide.data && !needs.length && <Empty>O guia está vazio.</Empty>}
      <div className="need-grid">
        {needs.map(n => (
          <NeedCard
            key={n.id}
            need={n}
            boards={benchmarks.data?.arenas ?? []}
            models={models.data?.models ?? null}
          />
        ))}
      </div>
    </div>
  );
}

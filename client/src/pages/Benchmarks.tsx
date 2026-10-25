import { useMemo, useState } from "react";
import type { ArenaBoard, Model } from "@shared/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  SourcesPanel,
} from "@/components/common";
import { useBenchmarks, useModels } from "@/lib/api";
import { day, int, num, price } from "@/lib/fmt";

const AA_BOARDS = [
  { id: "aa-intelligence", label: "Inteligência (AA)", key: "intelligenceIndex" as const },
  { id: "aa-coding", label: "Programação (AA)", key: "codingIndex" as const },
  { id: "aa-agentic", label: "Agentes (AA)", key: "agenticIndex" as const },
];
const AA_ROWS = 30;

/** Rating with its 95% interval drawn on a shared scale for the board. */
function RatingCell({ row, scale, metric }: {
  row: ArenaBoard["rows"][number];
  scale: [number, number];
  metric: ArenaBoard["metric"];
}) {
  const [lo, hi] = scale;
  const pos = (v: number) => `${((v - lo) / (hi - lo || 1)) * 100}%`;
  return (
    <span className="rating-cell">
      <b className="num">{metric === "elo" ? int(row.rating) : `${num(row.rating, 1)}%`}</b>
      <span className="ci" aria-hidden="true">
        <span className="ci-band" style={{ left: pos(row.lower), right: `calc(100% - ${pos(row.upper)})` }} />
        <span className="ci-dot" style={{ left: pos(row.rating) }} />
      </span>
    </span>
  );
}

function ArenaTable({ board }: { board: ArenaBoard }) {
  const scale: [number, number] = [
    Math.min(...board.rows.map(r => r.lower)),
    Math.max(...board.rows.map(r => r.upper)),
  ];
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Modelo</th>
            <th>{board.metric === "elo" ? "Nota (Elo)" : "Pontuação"}</th>
            <th className="hide-sm">{board.metric === "elo" ? "Votos" : "Sessões"}</th>
            <th className="hide-sm">Licença</th>
          </tr>
        </thead>
        <tbody>
          {board.rows.map(r => (
            <tr key={`${r.rank}-${r.model}`}>
              <td className="num rank">{r.rank}</td>
              <td className="model-cell">
                <b>{r.model}</b>
                <span className="model-sub">{r.organization}</span>
              </td>
              <td>
                <RatingCell row={r} scale={scale} metric={board.metric} />
              </td>
              <td className="num hide-sm">{int(r.votes)}</td>
              <td className="hide-sm">
                <span className={`tag ${/proprietary/i.test(r.license) ? "" : "free"}`}>
                  {/proprietary/i.test(r.license) ? "fechado" : r.license}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AaTable({ models, field }: { models: Model[]; field: (typeof AA_BOARDS)[number]["key"] }) {
  // Batch and :free variants repeat the same score; keep the first one of each name.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return models
      .filter(m => m[field] !== null)
      .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0))
      .filter(m => {
        const key = m.name.replace(/\s*\((batch|free)\)\s*$/i, "");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, AA_ROWS);
  }, [models, field]);
  if (!rows.length) return <Empty>Sem índices publicados agora.</Empty>;
  const top = rows[0][field] ?? 1;
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>#</th>
            <th>Modelo</th>
            <th>Índice</th>
            <th className="hide-sm">Entrada / saída (1M)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m, i) => (
            <tr key={m.id}>
              <td className="num rank">{i + 1}</td>
              <td className="model-cell">
                <a href={m.link} target="_blank" rel="noreferrer">
                  {m.name}
                </a>
                <span className="model-sub">
                  {m.providerLabel}
                  {m.openWeights && <span className="tag free">aberto</span>}
                </span>
              </td>
              <td>
                <span className="index-cell">
                  <span className="index-bar" aria-hidden="true">
                    <span style={{ width: `${((m[field] ?? 0) / top) * 100}%` }} />
                  </span>
                  <b className="num">{num(m[field] ?? 0, 1)}</b>
                </span>
              </td>
              <td className="num hide-sm">
                {price(m.inputPrice)} / {price(m.outputPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Benchmarks() {
  const benchmarks = useBenchmarks();
  const models = useModels();
  const boards = benchmarks.data?.arenas ?? [];
  const [selected, setSelected] = useState("text_style_control");
  const board = boards.find(b => b.id === selected);
  const aa = AA_BOARDS.find(b => b.id === selected);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Benchmarks"
        title="Quem está na frente"
        sub="Placares da LMArena (milhões de votos às cegas de pessoas comparando respostas) e índices da Artificial Analysis (baterias de testes padronizados). Nada aqui é digitado à mão."
        updatedAt={benchmarks.data?.updatedAt}
        loading={benchmarks.loading}
        onRefresh={benchmarks.refresh}
      />
      {benchmarks.error && !benchmarks.data && <ErrorNotice error={benchmarks.error} />}

      <div className="filter-chips board-tabs" role="tablist" aria-label="Placar">
        {boards.map(b => (
          <button key={b.id} role="tab" aria-selected={selected === b.id} aria-pressed={selected === b.id} onClick={() => setSelected(b.id)}>
            {b.label}
          </button>
        ))}
        {AA_BOARDS.map(b => (
          <button key={b.id} role="tab" aria-selected={selected === b.id} aria-pressed={selected === b.id} onClick={() => setSelected(b.id)}>
            {b.label}
          </button>
        ))}
      </div>

      <section className="card">
        {board && (
          <>
            <div className="card-head">
              <div>
                <h2>LMArena · {board.label}</h2>
                <p>{board.description}</p>
              </div>
              {board.publishedAt && <span className="chip">placar de {day(board.publishedAt)}</span>}
            </div>
            <ArenaTable board={board} />
            <p className="muted small note">
              A faixa ao lado da nota é o intervalo de confiança de 95%: modelos com faixas que se
              sobrepõem estão, na prática, empatados. Fonte:{" "}
              <a href="https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset">lmarena-ai/leaderboard-dataset</a> (CC BY 4.0).
            </p>
          </>
        )}
        {aa && (
          <>
            <div className="card-head">
              <div>
                <h2>Artificial Analysis · {aa.label.replace(" (AA)", "")}</h2>
                <p>
                  Índice composto de vários benchmarks padronizados (raciocínio, conhecimento,
                  matemática, código), publicado pela Artificial Analysis e repassado pela OpenRouter.
                </p>
              </div>
            </div>
            {models.data ? <AaTable models={models.data.models} field={aa.key} /> : <Loading />}
          </>
        )}
        {!board && !aa && (benchmarks.loading ? <Loading /> : <Empty>Placar indisponível agora.</Empty>)}
      </section>
      <SourcesPanel sources={benchmarks.data?.sources ?? []} />
    </div>
  );
}

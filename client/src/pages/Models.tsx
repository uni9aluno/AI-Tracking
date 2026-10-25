import { useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Search, X } from "lucide-react";
import type { Model } from "@shared/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  SourcesPanel,
} from "@/components/common";
import { useModels } from "@/lib/api";
import { ago, day, int, num, price, tokens } from "@/lib/fmt";

type Sort = "novos" | "inteligencia" | "codigo" | "preco" | "contexto";
const SORTS: { id: Sort; label: string }[] = [
  { id: "novos", label: "Mais novos" },
  { id: "inteligencia", label: "Inteligência" },
  { id: "codigo", label: "Programação" },
  { id: "preco", label: "Mais baratos" },
  { id: "contexto", label: "Maior contexto" },
];
const TOGGLES = [
  { id: "free", label: "Grátis", test: (m: Model) => m.free },
  { id: "open", label: "Pesos abertos", test: (m: Model) => m.openWeights },
  { id: "vision", label: "Aceita imagem", test: (m: Model) => m.inputModalities.includes("image") },
  { id: "audio", label: "Aceita áudio", test: (m: Model) => m.inputModalities.includes("audio") },
  { id: "imageOut", label: "Gera imagem", test: (m: Model) => m.outputModalities.includes("image") },
  { id: "tools", label: "Usa ferramentas", test: (m: Model) => m.tools },
  { id: "reasoning", label: "Raciocínio", test: (m: Model) => m.reasoning },
  { id: "indexed", label: "Com índice", test: (m: Model) => m.intelligenceIndex !== null },
] as const;
type Toggle = (typeof TOGGLES)[number]["id"];
const CONTEXTS = [0, 128_000, 200_000, 1_000_000];
const NEW_MS = 7 * 86_400_000;
const PAGE = 80;
const MAX_COMPARE = 4;

const blended = (m: Model) =>
  m.inputPrice === null || m.outputPrice === null ? Infinity : m.inputPrice + m.outputPrice;

function sorter(sort: Sort) {
  const desc = (v: number | null) => (v === null ? -Infinity : v);
  switch (sort) {
    case "inteligencia":
      return (a: Model, b: Model) => desc(b.intelligenceIndex) - desc(a.intelligenceIndex);
    case "codigo":
      return (a: Model, b: Model) => desc(b.codingIndex) - desc(a.codingIndex);
    case "preco":
      return (a: Model, b: Model) => blended(a) - blended(b);
    case "contexto":
      return (a: Model, b: Model) => (b.contextLength ?? 0) - (a.contextLength ?? 0);
    default:
      return (a: Model, b: Model) => b.createdAt.localeCompare(a.createdAt);
  }
}

const modalities = (m: Model) =>
  [
    m.inputModalities.includes("image") && "imagem",
    m.inputModalities.includes("audio") && "áudio",
    m.inputModalities.includes("video") && "vídeo",
    m.inputModalities.includes("file") && "arquivo",
  ].filter(Boolean) as string[];

function IndexBar({ value }: { value: number | null }) {
  if (value === null) return <span className="muted">—</span>;
  return (
    <span className="index-cell">
      <span className="index-bar" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (value / 70) * 100)}%` }} />
      </span>
      <b className="num">{num(value, 1)}</b>
    </span>
  );
}

export default function Models() {
  const models = useModels();
  const [q, setQ] = useState("");
  const [provider, setProvider] = useState("");
  const [sort, setSort] = useState<Sort>("novos");
  const [toggles, setToggles] = useState<Set<Toggle>>(new Set());
  const [minContext, setMinContext] = useState(0);
  const [compare, setCompare] = useState<string[]>([]);
  const [limit, setLimit] = useState(PAGE);

  const all = models.data?.models ?? [];
  const providers = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const m of all) {
      const entry = counts.get(m.provider) ?? { label: m.providerLabel, count: 0 };
      entry.count++;
      counts.set(m.provider, entry);
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [all]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all
      .filter(
        m =>
          (!term || `${m.name} ${m.id} ${m.providerLabel}`.toLowerCase().includes(term)) &&
          (!provider || m.provider === provider) &&
          (m.contextLength ?? 0) >= minContext &&
          TOGGLES.every(t => !toggles.has(t.id) || t.test(m))
      )
      .sort(sorter(sort));
  }, [all, q, provider, sort, toggles, minContext]);

  const now = Date.now();
  const newCount = all.filter(m => now - Date.parse(m.createdAt) < NEW_MS).length;
  const chosen = compare.map(id => all.find(m => m.id === id)).filter(Boolean) as Model[];
  const flip = (id: Toggle) =>
    setToggles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleCompare = (id: string) =>
    setCompare(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= MAX_COMPARE ? prev : [...prev, id]
    );

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Modelos"
        title="Modelos, preços e capacidades"
        sub={
          <>
            {int(all.length)} modelos disponíveis na OpenRouter, {int(newCount)} adicionados nos
            últimos 7 dias. Preço em dólar por milhão de tokens; índices da Artificial Analysis.
          </>
        }
        updatedAt={models.data?.updatedAt}
        loading={models.loading}
        onRefresh={models.refresh}
      />
      {models.error && !models.data && <ErrorNotice error={models.error} />}

      <section className="card filters" aria-label="Filtros">
        <div className="toolbar">
          <label className="search">
            <Search size={17} aria-hidden="true" />
            <input
              className="input"
              type="search"
              placeholder="Buscar modelo"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setLimit(PAGE);
              }}
            />
          </label>
          <select className="input" value={provider} onChange={e => setProvider(e.target.value)} aria-label="Empresa">
            <option value="">Todas as empresas</option>
            {providers.map(([id, p]) => (
              <option key={id} value={id}>
                {p.label} ({p.count})
              </option>
            ))}
          </select>
          <select
            className="input"
            value={minContext}
            onChange={e => setMinContext(Number(e.target.value))}
            aria-label="Contexto mínimo"
          >
            {CONTEXTS.map(c => (
              <option key={c} value={c}>
                {c ? `Contexto ≥ ${tokens(c)}` : "Qualquer contexto"}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-chips" role="group" aria-label="Capacidades">
          {TOGGLES.map(t => (
            <button key={t.id} aria-pressed={toggles.has(t.id)} onClick={() => flip(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="segmented wrap" role="group" aria-label="Ordenar">
          {SORTS.map(s => (
            <button key={s.id} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {chosen.length > 0 && (
        <section className="card compare" aria-label="Comparação">
          <div className="card-head">
            <h2>Comparando {chosen.length}</h2>
            <button className="link-btn" onClick={() => setCompare([])}>
              Limpar
            </button>
          </div>
          <div className="table-wrap">
            <table className="data compare-table">
              <thead>
                <tr>
                  <th />
                  {chosen.map(m => (
                    <th key={m.id}>
                      <span className="compare-name">
                        {m.name}
                        <button className="icon-btn sm" onClick={() => toggleCompare(m.id)} aria-label={`Tirar ${m.name}`}>
                          <X size={14} />
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Empresa", (m: Model) => m.providerLabel],
                  ["Inteligência", (m: Model) => <IndexBar value={m.intelligenceIndex} />],
                  ["Programação", (m: Model) => <IndexBar value={m.codingIndex} />],
                  ["Agentes", (m: Model) => <IndexBar value={m.agenticIndex} />],
                  ["Entrada / 1M", (m: Model) => price(m.inputPrice)],
                  ["Saída / 1M", (m: Model) => price(m.outputPrice)],
                  ["Contexto", (m: Model) => tokens(m.contextLength)],
                  ["Entende", (m: Model) => ["texto", ...modalities(m)].join(", ")],
                  ["Ferramentas", (m: Model) => (m.tools ? "sim" : "não")],
                  ["Pesos abertos", (m: Model) => (m.openWeights ? "sim" : "não")],
                  ["Na OpenRouter desde", (m: Model) => day(m.createdAt)],
                ].map(([label, cell]) => (
                  <tr key={label as string}>
                    <th scope="row">{label as string}</th>
                    {chosen.map(m => (
                      <td key={m.id}>{(cell as (m: Model) => ReactNode)(m)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="result-line">
        <span>
          <b>{int(visible.length)}</b> modelos · marque até {MAX_COMPARE} para comparar
        </span>
      </p>
      {!models.data && models.loading && <Loading />}
      {models.data && visible.length === 0 && <Empty>Nenhum modelo com esses filtros.</Empty>}
      {visible.length > 0 && (
        <div className="card flush">
          <div className="table-wrap">
            <table className="data models-table">
              <thead>
                <tr>
                  <th aria-label="Comparar" />
                  <th>Modelo</th>
                  <th>Inteligência</th>
                  <th>Programação</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Contexto</th>
                  <th>Adicionado</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, limit).map(m => {
                  const isNew = now - Date.parse(m.createdAt) < NEW_MS;
                  return (
                    <tr key={m.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={compare.includes(m.id)}
                          disabled={!compare.includes(m.id) && compare.length >= MAX_COMPARE}
                          onChange={() => toggleCompare(m.id)}
                          aria-label={`Comparar ${m.name}`}
                        />
                      </td>
                      <td className="model-cell">
                        <a href={m.link} target="_blank" rel="noreferrer" title={m.description}>
                          {m.name} <ExternalLink size={12} aria-hidden="true" />
                        </a>
                        <span className="model-sub">
                          {m.providerLabel}
                          {isNew && <span className="tag new">novo</span>}
                          {m.free && <span className="tag free">grátis</span>}
                          {m.openWeights && <span className="tag">aberto</span>}
                          {modalities(m).map(x => (
                            <span key={x} className="tag">
                              {x}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        <IndexBar value={m.intelligenceIndex} />
                      </td>
                      <td>
                        <IndexBar value={m.codingIndex} />
                      </td>
                      <td className="num">{price(m.inputPrice)}</td>
                      <td className="num">{price(m.outputPrice)}</td>
                      <td className="num">{tokens(m.contextLength)}</td>
                      <td title={day(m.createdAt)}>{ago(m.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {visible.length > limit && (
        <button className="btn more" onClick={() => setLimit(l => l + PAGE)}>
          Mostrar mais ({int(visible.length - limit)} restantes)
        </button>
      )}
      <p className="muted small">
        Índices de inteligência, programação e agentes: Artificial Analysis, como publicados pela
        OpenRouter (escala até ~70 hoje; vazio quando o modelo não foi avaliado). Variantes "batch"
        e ":free" aparecem separadas porque têm preço e limites próprios.
      </p>
      <SourcesPanel sources={models.data?.sources ?? []} />
    </div>
  );
}

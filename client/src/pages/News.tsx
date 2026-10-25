import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearch } from "wouter";
import {
  SOURCE_KIND_LABEL,
  TOPICS,
  type NewsItem,
  type SourceKind,
  type Topic,
} from "@shared/types";
import {
  Empty,
  ErrorNotice,
  FilterChips,
  Loading,
  PageHeader,
  SourcesPanel,
} from "@/components/common";
import NewsCard from "@/components/NewsCard";
import { storyWeight } from "@shared/news";
import { useNews } from "@/lib/api";
import { int, plural } from "@/lib/fmt";
import { newsEntry, useSaved } from "@/lib/saved";

const PERIODS = [
  { id: "24h", label: "24 horas", ms: 86_400_000 },
  { id: "48h", label: "48 horas", ms: 2 * 86_400_000 },
  { id: "7d", label: "7 dias", ms: 7 * 86_400_000 },
] as const;
type Period = (typeof PERIODS)[number]["id"];
const PAGE = 60;

type Filters = {
  topico: Topic | null;
  empresa: string | null;
  modelo: string | null;
  fonte: SourceKind | null;
  idioma: "pt" | "en" | null;
  periodo: Period;
  q: string;
  ordem: "recentes" | "destaque";
  ocultarLidos: boolean;
};

function readFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const pick = <T extends string>(key: string, allowed: readonly T[]) => {
    const v = p.get(key) as T | null;
    return v && allowed.includes(v) ? v : null;
  };
  return {
    topico: pick("topico", Object.keys(TOPICS) as Topic[]),
    empresa: p.get("empresa"),
    modelo: p.get("modelo"),
    fonte: pick("fonte", Object.keys(SOURCE_KIND_LABEL) as SourceKind[]),
    idioma: pick("idioma", ["pt", "en"] as const),
    periodo: pick("periodo", PERIODS.map(x => x.id)) ?? "7d",
    q: p.get("q") ?? "",
    ordem: pick("ordem", ["recentes", "destaque"] as const) ?? "recentes",
    ocultarLidos: p.get("lidos") === "ocultar",
  };
}

function writeFilters(f: Filters) {
  const p = new URLSearchParams();
  if (f.topico) p.set("topico", f.topico);
  if (f.empresa) p.set("empresa", f.empresa);
  if (f.modelo) p.set("modelo", f.modelo);
  if (f.fonte) p.set("fonte", f.fonte);
  if (f.idioma) p.set("idioma", f.idioma);
  if (f.periodo !== "7d") p.set("periodo", f.periodo);
  if (f.q) p.set("q", f.q);
  if (f.ordem !== "recentes") p.set("ordem", f.ordem);
  if (f.ocultarLidos) p.set("lidos", "ocultar");
  const query = p.toString();
  // replaceState: filtering should not fill the back button history.
  window.history.replaceState(null, "", `/noticias${query ? `?${query}` : ""}`);
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function countBy<T extends string>(items: NewsItem[], pick: (i: NewsItem) => T[]) {
  const counts = new Map<T, number>();
  for (const item of items) for (const key of pick(item)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

export default function News() {
  const news = useNews();
  const search = useSearch();
  const [filters, setFilters] = useState(() => readFilters(search));
  const [limit, setLimit] = useState(PAGE);
  const { isRead } = useSaved();
  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setLimit(PAGE);
    writeFilters(next);
  };

  const items = news.data?.items ?? [];
  // Counts for each facet ignore that facet's own filter, so every chip shows what clicking it would give.
  const { visible, counts } = useMemo(() => {
    const now = Date.now();
    const period = PERIODS.find(p => p.id === filters.periodo)!.ms;
    const q = fold(filters.q.trim());
    const base = items.filter(
      i =>
        now - Date.parse(i.publishedAt) < period &&
        (!q || fold(`${i.title} ${i.summary} ${i.source}`).includes(q)) &&
        (!filters.ocultarLidos || !isRead(newsEntry(i).id))
    );
    const match = (i: NewsItem, skip: keyof Filters | null) =>
      (skip === "topico" || !filters.topico || i.topics.includes(filters.topico)) &&
      (skip === "empresa" || !filters.empresa || i.companies.includes(filters.empresa)) &&
      (skip === "modelo" || !filters.modelo || i.models.includes(filters.modelo)) &&
      (skip === "fonte" || !filters.fonte || i.kind === filters.fonte) &&
      (skip === "idioma" || !filters.idioma || i.lang === filters.idioma);
    const visible = base.filter(i => match(i, null));
    if (filters.ordem === "destaque")
      visible.sort((a, b) => storyWeight(b) - storyWeight(a) || b.publishedAt.localeCompare(a.publishedAt));
    return {
      visible,
      counts: {
        topico: countBy(base.filter(i => match(i, "topico")), i => i.topics),
        empresa: countBy(base.filter(i => match(i, "empresa")), i => i.companies),
        modelo: countBy(base.filter(i => match(i, "modelo")), i => i.models),
        fonte: countBy(base.filter(i => match(i, "fonte")), i => [i.kind]),
        idioma: countBy(base.filter(i => match(i, "idioma")), i => [i.lang]),
      },
    };
  }, [items, filters, isRead]);

  const sortedOptions = <T extends string>(
    options: { id: T; label: string }[],
    count: Map<T, number>,
    selected: string | null
  ) =>
    options
      .map(o => ({ ...o, count: count.get(o.id) ?? 0 }))
      .filter(o => o.count > 0 || o.id === selected)
      .sort((a, b) => b.count - a.count);

  const active =
    [filters.topico, filters.empresa, filters.modelo, filters.fonte, filters.idioma, filters.q].filter(Boolean)
      .length > 0;

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Notícias"
        title="Tudo o que saiu sobre IA"
        sub={`${plural(news.data?.sources.length ?? 0, "fonte", "fontes")}: laboratórios, imprensa e comunidade. Cada matéria recebe tópicos, empresas e modelos por regras.`}
        updatedAt={news.data?.updatedAt}
        loading={news.loading}
        onRefresh={news.refresh}
      />
      {news.error && !news.data && <ErrorNotice error={news.error} />}

      <section className="card filters" aria-label="Filtros">
        <div className="toolbar">
          <label className="search">
            <Search size={17} aria-hidden="true" />
            <input
              className="input"
              type="search"
              placeholder="Buscar no título ou resumo"
              value={filters.q}
              onChange={e => update({ q: e.target.value })}
            />
          </label>
          <div className="segmented" role="group" aria-label="Período">
            {PERIODS.map(p => (
              <button key={p.id} aria-pressed={filters.periodo === p.id} onClick={() => update({ periodo: p.id })}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Ordem">
            <button aria-pressed={filters.ordem === "recentes"} onClick={() => update({ ordem: "recentes" })}>
              Recentes
            </button>
            <button aria-pressed={filters.ordem === "destaque"} onClick={() => update({ ordem: "destaque" })}>
              Destaques
            </button>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.ocultarLidos}
              onChange={e => update({ ocultarLidos: e.target.checked })}
            />
            Ocultar lidas
          </label>
        </div>
        <FilterChips
          label="Tópico"
          value={filters.topico}
          onChange={topico => update({ topico })}
          options={sortedOptions(
            (Object.keys(TOPICS) as Topic[]).map(id => ({ id, label: TOPICS[id] })),
            counts.topico,
            filters.topico
          )}
        />
        <FilterChips
          label="Empresa"
          value={filters.empresa}
          onChange={empresa => update({ empresa })}
          options={sortedOptions(news.data?.companies ?? [], counts.empresa, filters.empresa)}
        />
        <FilterChips
          label="Modelo"
          value={filters.modelo}
          onChange={modelo => update({ modelo })}
          options={sortedOptions(news.data?.models ?? [], counts.modelo, filters.modelo)}
        />
        <div className="filter-pair">
          <FilterChips
            label="Fonte"
            value={filters.fonte}
            onChange={fonte => update({ fonte })}
            options={(Object.keys(SOURCE_KIND_LABEL) as SourceKind[]).map(id => ({
              id,
              label: SOURCE_KIND_LABEL[id],
              count: counts.fonte.get(id) ?? 0,
            }))}
          />
          <FilterChips
            label="Idioma"
            value={filters.idioma}
            onChange={idioma => update({ idioma })}
            options={[
              { id: "pt" as const, label: "Português", count: counts.idioma.get("pt") ?? 0 },
              { id: "en" as const, label: "Inglês", count: counts.idioma.get("en") ?? 0 },
            ]}
          />
        </div>
      </section>

      <div className="result-line">
        <span>
          <b>{int(visible.length)}</b> {visible.length === 1 ? "matéria" : "matérias"}
        </span>
        {active && (
          <button
            className="link-btn"
            onClick={() =>
              update({ topico: null, empresa: null, modelo: null, fonte: null, idioma: null, q: "" })
            }
          >
            Limpar filtros
          </button>
        )}
      </div>

      {!news.data && news.loading && <Loading />}
      {news.data && visible.length === 0 && (
        <Empty>Nenhuma matéria com esses filtros. Tente outro período ou limpe os filtros.</Empty>
      )}
      <div className="news-list">
        {visible.slice(0, limit).map(item => (
          <NewsCard key={item.id} item={item} onTopic={topico => update({ topico })} />
        ))}
      </div>
      {visible.length > limit && (
        <button className="btn more" onClick={() => setLimit(l => l + PAGE)}>
          Mostrar mais ({int(visible.length - limit)} restantes)
        </button>
      )}
      <SourcesPanel sources={news.data?.sources ?? []} />
    </div>
  );
}

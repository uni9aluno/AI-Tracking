import { useMemo, useState } from "react";
import { Cpu, Newspaper } from "lucide-react";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/common";
import { useModels, useNews } from "@/lib/api";
import { int, price, tokens } from "@/lib/fmt";

type Event = {
  id: string;
  date: string;
  kind: "modelo" | "noticia";
  title: string;
  detail: string;
  link: string;
};

const RANGES = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dayTitle = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
};

/** Launches: models as they reach OpenRouter, plus news classified as "novos modelos" (7 days kept). */
export default function Timeline() {
  const models = useModels();
  const news = useNews();
  const [range, setRange] = useState(30);
  const [kind, setKind] = useState<"todos" | Event["kind"]>("todos");

  const days = useMemo(() => {
    const since = Date.now() - range * 86_400_000;
    const events: Event[] = [
      ...(models.data?.models ?? [])
        // A ":free" twin is the same launch.
        .filter(m => !m.id.endsWith(":free"))
        .map(m => ({
          id: `m:${m.id}`,
          date: m.createdAt,
          kind: "modelo" as const,
          title: m.name,
          detail: `${m.providerLabel} · ${price(m.inputPrice)} / ${price(m.outputPrice)} por 1M · contexto ${tokens(m.contextLength)}`,
          link: m.link,
        })),
      ...(news.data?.items ?? [])
        .filter(i => i.topics.includes("novos-modelos"))
        .map(i => ({
          id: `n:${i.id}`,
          date: i.publishedAt,
          kind: "noticia" as const,
          title: i.title,
          detail: i.source,
          link: i.link,
        })),
    ].filter(e => Date.parse(e.date) >= since && (kind === "todos" || e.kind === kind));
    const groups = new Map<string, Event[]>();
    for (const e of events.sort((a, b) => b.date.localeCompare(a.date))) {
      const key = dayKey(e.date);
      groups.set(key, [...(groups.get(key) ?? []), e]);
    }
    return [...groups.entries()];
  }, [models.data, news.data, range, kind]);

  const loading = !models.data && models.loading;
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Linha do tempo"
        title="Lançamentos, dia a dia"
        sub="Modelos na data em que chegaram à OpenRouter (vale como data de lançamento para quase todos) e notícias classificadas como novo modelo. As notícias ficam guardadas por 7 dias."
        updatedAt={models.data?.updatedAt}
        loading={models.loading}
        onRefresh={models.refresh}
      />
      {models.error && !models.data && <ErrorNotice error={models.error} />}
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Período">
          {RANGES.map(r => (
            <button key={r.days} aria-pressed={range === r.days} onClick={() => setRange(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Tipo">
          <button aria-pressed={kind === "todos"} onClick={() => setKind("todos")}>
            Tudo
          </button>
          <button aria-pressed={kind === "modelo"} onClick={() => setKind("modelo")}>
            Modelos
          </button>
          <button aria-pressed={kind === "noticia"} onClick={() => setKind("noticia")}>
            Notícias
          </button>
        </div>
      </div>
      {loading && <Loading />}
      {!loading && days.length === 0 && <Empty>Nenhum lançamento nesse período.</Empty>}
      <ol className="timeline">
        {days.map(([key, events]) => (
          <li key={key}>
            <h2 className="timeline-day">
              {dayTitle(key)} <span className="muted">{int(events.length)}</span>
            </h2>
            <ul className="plain">
              {events.map(e => (
                <li key={e.id} className={`timeline-item ${e.kind}`}>
                  <span className="timeline-icon" aria-hidden="true">
                    {e.kind === "modelo" ? <Cpu size={15} /> : <Newspaper size={15} />}
                  </span>
                  <span>
                    <a href={e.link} target="_blank" rel="noreferrer">
                      {e.title}
                    </a>
                    <small>{e.detail}</small>
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

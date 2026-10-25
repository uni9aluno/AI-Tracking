import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Heart,
  ThumbsUp,
} from "lucide-react";
import { Link, useParams } from "wouter";
import {
  RESEARCH_KIND_LABEL,
  type ResearchItem,
  type ResearchKind,
  type ResearchProvider,
} from "@shared/types";
import { Empty, ErrorNotice, Loading, PageHeader, SourcesPanel } from "@/components/common";
import { useResearch } from "@/lib/api";
import { ago, fullDay, int } from "@/lib/fmt";
import { markRead, researchEntry, toggleSaved, useSaved } from "@/lib/saved";

const KINDS = Object.keys(RESEARCH_KIND_LABEL) as ResearchKind[];
const SINGULAR: Record<ResearchKind, string> = {
  post: "Publicação",
  paper: "Artigo",
  weights: "Pesos abertos",
};
const PREVIEW = 3;

const initials = (label: string) =>
  label
    .replace(/\(.*\)/, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

function ItemDate({ item }: { item: ResearchItem }) {
  if (!item.publishedAt) return <span className="muted">sem data na fonte</span>;
  return (
    <time dateTime={item.publishedAt} title={ago(item.publishedAt)}>
      {fullDay(item.publishedAt)}
    </time>
  );
}

function ResearchCard({
  item,
  provider,
  featured = false,
}: {
  item: ResearchItem;
  provider: string;
  featured?: boolean;
}) {
  const { isSaved, isRead } = useSaved();
  const entry = researchEntry(item, provider);
  const saved = isSaved(entry.id);
  return (
    <article
      className={`news-card research-card ${featured ? "featured" : ""} ${isRead(entry.id) ? "read" : ""}`}
    >
      <header className="news-meta">
        <span className={`tag kind-${item.kind}`}>{SINGULAR[item.kind]}</span>
        <span className="news-source">{item.sourceLabel}</span>
        {item.upvotes !== undefined && (
          <span
            className="votes"
            title={item.kind === "paper" ? "Votos no Hugging Face Papers" : "Curtidas no Hugging Face"}
          >
            {item.kind === "paper" ? (
              <ThumbsUp size={13} aria-hidden="true" />
            ) : (
              <Heart size={13} aria-hidden="true" />
            )}{" "}
            {int(item.upvotes)}
          </span>
        )}
        <ItemDate item={item} />
        <button
          className="save-btn"
          onClick={() => toggleSaved(entry)}
          aria-pressed={saved}
          aria-label={saved ? "Remover dos salvos" : "Salvar"}
        >
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
      </header>
      <a
        className="news-title"
        href={item.link}
        target="_blank"
        rel="noreferrer"
        onClick={() => markRead(entry.id)}
      >
        {item.title}
      </a>
      {item.summary && <p className="news-summary">{item.summary}</p>}
    </article>
  );
}

const counts = (provider: ResearchProvider) =>
  KINDS.map(kind => ({ kind, count: provider.items.filter(i => i.kind === kind).length })).filter(
    c => c.count > 0
  );

function ProviderCard({ provider }: { provider: ResearchProvider }) {
  const latest = provider.items.find(i => i.publishedAt)?.publishedAt;
  return (
    <section className="card need-card research-provider">
      <div className="need-head">
        <span className="need-icon provider-mark" aria-hidden="true">
          {initials(provider.label)}
        </span>
        <div>
          <h2>
            <Link href={`/pesquisa/${provider.id}`}>{provider.label}</Link>
          </h2>
          <p>{provider.description}</p>
        </div>
      </div>
      <div className="research-counts">
        {counts(provider).map(c => (
          <span key={c.kind} className={`tag kind-${c.kind}`}>
            {RESEARCH_KIND_LABEL[c.kind]} {int(c.count)}
          </span>
        ))}
        {latest && <span className="muted small">última {ago(latest)}</span>}
      </div>
      {provider.items.length ? (
        <ul className="plain mini-list">
          {provider.items.slice(0, PREVIEW).map(item => (
            <li key={item.id}>
              <a href={item.link} target="_blank" rel="noreferrer">
                {item.title}
              </a>
              <small>
                {SINGULAR[item.kind]} · {item.publishedAt ? fullDay(item.publishedAt) : "sem data"}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Nenhum item coletado ainda.</p>
      )}
      <Link href={`/pesquisa/${provider.id}`} className="link-btn research-open">
        Abrir a área de {provider.label} <ChevronRight size={15} aria-hidden="true" />
      </Link>
    </section>
  );
}

function ProviderArea({
  provider,
  providers,
}: {
  provider: ResearchProvider;
  providers: ResearchProvider[];
}) {
  const [kind, setKind] = useState<ResearchKind | null>(null);
  const list = provider.items.filter(i => !kind || i.kind === kind);
  const [first, ...rest] = list;
  return (
    <>
      <nav className="filter-chips provider-switch" aria-label="Provedores">
        <Link href="/pesquisa">
          <ArrowLeft size={14} aria-hidden="true" /> Todos
        </Link>
        {providers.map(p => (
          <Link
            key={p.id}
            href={`/pesquisa/${p.id}`}
            aria-current={p.id === provider.id ? "page" : undefined}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Tipo">
          <button aria-pressed={kind === null} onClick={() => setKind(null)}>
            Tudo ({int(provider.items.length)})
          </button>
          {counts(provider).map(c => (
            <button key={c.kind} aria-pressed={kind === c.kind} onClick={() => setKind(c.kind)}>
              {RESEARCH_KIND_LABEL[c.kind]} ({int(c.count)})
            </button>
          ))}
        </div>
        <a className="link-btn" href={provider.homepage} target="_blank" rel="noreferrer">
          Página oficial <ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </div>
      {!list.length && <Empty>Nenhum item coletado ainda para {provider.label}.</Empty>}
      {first && <ResearchCard item={first} provider={provider.label} featured />}
      <div className="news-list">
        {rest.map(item => (
          <ResearchCard key={item.id} item={item} provider={provider.label} />
        ))}
      </div>
    </>
  );
}

export default function Research() {
  const { provider: providerId } = useParams<{ provider?: string }>();
  const research = useResearch();
  const providers = research.data?.providers ?? [];
  const provider = providerId ? providers.find(p => p.id === providerId) : undefined;
  const sources = (research.data?.sources ?? []).filter(
    s => !provider || provider.sourceIds.includes(s.id)
  );
  return (
    <div className="stack">
      <PageHeader
        eyebrow={provider ? "Pesquisa" : "Pesquisa dos laboratórios"}
        title={provider ? provider.label : "Pesquisa por provedor"}
        sub={
          provider
            ? `${provider.description} Títulos e resumos no original.`
            : "O que cada laboratório publicou: posts das páginas de pesquisa e blogs oficiais, artigos que o laboratório assina no Hugging Face Papers e modelos de pesos abertos. Coletado a cada 30 minutos; títulos e resumos no original."
        }
        updatedAt={research.data?.updatedAt}
        loading={research.loading}
        onRefresh={research.refresh}
      />
      {research.error && !research.data && <ErrorNotice error={research.error} />}
      {!research.data && research.loading && <Loading />}
      {research.data && providerId && !provider && (
        <Empty>
          Não há área para “{providerId}”. <Link href="/pesquisa">Ver todos os provedores</Link>.
        </Empty>
      )}
      {provider ? (
        <ProviderArea provider={provider} providers={providers} />
      ) : (
        !providerId && (
          <div className="need-grid">
            {providers.map(p => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        )
      )}
      <SourcesPanel sources={sources} />
    </div>
  );
}

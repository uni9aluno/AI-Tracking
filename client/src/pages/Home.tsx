import { AlertTriangle, ArrowRight, CheckCircle2, Cpu, Flame, Newspaper, Star, ThumbsUp } from "lucide-react";
import { Link } from "wouter";
import { TOPICS, type ApiService, type Topic } from "@shared/types";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/common";
import NewsCard from "@/components/NewsCard";
import { useOverview } from "@/lib/api";
import { ago, int, num, price, short, tokens } from "@/lib/fmt";

const QUICK_TOPICS: Topic[] = [
  "novos-modelos",
  "novas-funcoes",
  "ciberseguranca",
  "agentes",
  "codigo",
  "open-source",
  "imagem-video",
  "regulacao",
  "negocios",
  "pesquisa",
];

const SERVICE_TONE: Record<ApiService["indicator"], string> = {
  none: "ok",
  maintenance: "warn",
  minor: "warn",
  major: "bad",
  critical: "bad",
  unknown: "",
};

function SectionTitle({ title, href, icon: Icon }: { title: string; href: string; icon: typeof Cpu }) {
  return (
    <div className="section-title">
      <h2>
        <Icon size={20} aria-hidden="true" /> {title}
      </h2>
      <Link href={href}>
        Ver tudo <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

export default function Home() {
  const overview = useOverview();
  const data = overview.data;
  const problems = data?.services.filter(s => s.indicator !== "none" && s.indicator !== "unknown") ?? [];
  return (
    <div>
      <PageHeader
        eyebrow="Radar IA"
        title="O que está acontecendo em IA agora"
        sub="Notícias, modelos novos, placares e pesquisa, coletados de fontes públicas a cada 5 minutos."
        updatedAt={data?.sources.map(s => s.fetchedAt).sort().at(-1) ?? null}
        loading={overview.loading}
        onRefresh={overview.refresh}
      />
      {overview.error && !data && <ErrorNotice error={overview.error} />}
      {!data && overview.loading && <Loading label="Coletando as fontes pela primeira vez…" />}

      {data && (
        <>
          <dl className="stats">
            <div>
              <dt>Notícias em 24 h</dt>
              <dd>{int(data.counts.news24h)}</dd>
            </div>
            <div>
              <dt>Modelos novos em 7 dias</dt>
              <dd>{int(data.counts.newModels7d)}</dd>
            </div>
            <div>
              <dt>Fontes</dt>
              <dd>
                {int(data.counts.sources)}
                {data.counts.failing > 0 && <small className="warn-text"> · {data.counts.failing} com erro</small>}
              </dd>
            </div>
            <div>
              <dt>APIs com problema</dt>
              <dd>{int(problems.length)}</dd>
            </div>
          </dl>

          <nav className="filter-chips topic-jump" aria-label="Notícias por tópico">
            {QUICK_TOPICS.map(t => (
              <Link key={t} href={`/noticias?topico=${t}`} className={`tag topic-${t}`}>
                {TOPICS[t]}
              </Link>
            ))}
          </nav>

          <div className="home-grid">
            <div className="home-main">
              <SectionTitle title="Destaques" href="/noticias?ordem=destaque&periodo=48h" icon={Flame} />
              {data.highlights.length ? (
                <div className="news-list">
                  {data.highlights.map(item => (
                    <NewsCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <Empty>Nenhuma história repetida entre fontes nas últimas 48 horas ainda.</Empty>
              )}

              <SectionTitle title="Últimas notícias" href="/noticias" icon={Newspaper} />
              <div className="news-list">
                {data.latest.map(item => (
                  <NewsCard key={item.id} item={item} compact />
                ))}
              </div>
            </div>

            <aside className="home-side">
              <section className="card">
                <div className="card-head">
                  <h2>Status das APIs</h2>
                </div>
                <ul className="plain service-list">
                  {data.services.map(s => (
                    <li key={s.id}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.label}
                      </a>
                      <span className={`chip sm ${SERVICE_TONE[s.indicator]}`} title={s.description}>
                        {s.indicator === "none" ? (
                          <CheckCircle2 size={13} aria-hidden="true" />
                        ) : (
                          <AlertTriangle size={13} aria-hidden="true" />
                        )}
                        {s.indicator === "none" ? "normal" : s.indicator === "unknown" ? "sem dados" : s.description}
                      </span>
                      {s.incidents.slice(0, 2).map(i => (
                        <a key={i.name} className="incident" href={i.url} target="_blank" rel="noreferrer">
                          {i.name}
                        </a>
                      ))}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Modelos novos</h2>
                  <Link href="/linha-do-tempo">Linha do tempo</Link>
                </div>
                {data.newModels.length ? (
                  <ul className="plain mini-list">
                    {data.newModels.slice(0, 8).map(m => (
                      <li key={m.id}>
                        <a href={m.link} target="_blank" rel="noreferrer">
                          {m.name}
                        </a>
                        <small>
                          {m.providerLabel} · {price(m.inputPrice)} / {price(m.outputPrice)} · {tokens(m.contextLength)} · {ago(m.createdAt)}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted small">Nenhum modelo novo na OpenRouter nos últimos 7 dias.</p>
                )}
              </section>

              {data.arenaTop.slice(0, 2).map(board => (
                <section className="card" key={board.board}>
                  <div className="card-head">
                    <h2>Arena · {board.label}</h2>
                    <Link href="/benchmarks">Placares</Link>
                  </div>
                  <ol className="rank-list">
                    {board.rows.map(r => (
                      <li key={r.model}>
                        <span>
                          <b>{r.model}</b>
                          <small>{r.organization}</small>
                        </span>
                        <span className="num muted">
                          {board.metric === "elo" ? int(r.rating) : `${num(r.rating, 1)}%`}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}

              <section className="card">
                <div className="card-head">
                  <h2>Artigos em alta</h2>
                  <Link href="/artigos">Artigos</Link>
                </div>
                <ul className="plain mini-list">
                  {data.papers.map(p => (
                    <li key={p.id}>
                      <a href={p.link} target="_blank" rel="noreferrer">
                        {p.title}
                      </a>
                      <small>
                        <ThumbsUp size={11} aria-hidden="true" /> {int(p.upvotes ?? 0)} votos
                      </small>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card">
                <div className="card-head">
                  <h2>Em alta no GitHub</h2>
                  <Link href="/em-alta">Em alta</Link>
                </div>
                <ul className="plain mini-list">
                  {data.repos.map(r => (
                    <li key={r.id}>
                      <a href={r.url} target="_blank" rel="noreferrer">
                        {r.name}
                      </a>
                      <small>
                        <Star size={11} aria-hidden="true" /> {short(r.stars)} · {r.description}
                      </small>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

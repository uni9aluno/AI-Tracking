import { useState } from "react";
import { Bookmark, BookmarkCheck, Github, ThumbsUp } from "lucide-react";
import type { Paper } from "@shared/types";
import { Empty, ErrorNotice, Loading, PageHeader, SourcesPanel } from "@/components/common";
import { usePapers } from "@/lib/api";
import { ago, int } from "@/lib/fmt";
import { markRead, paperEntry, toggleSaved, useSaved } from "@/lib/saved";

const AREA: Record<string, string> = {
  "cs.AI": "IA",
  "cs.CL": "Linguagem",
  "cs.LG": "Aprendizado de máquina",
  "cs.CV": "Visão computacional",
  "cs.RO": "Robótica",
  "cs.CR": "Segurança",
  "cs.SE": "Engenharia de software",
};

function PaperCard({ paper }: { paper: Paper }) {
  const { isSaved, isRead } = useSaved();
  const entry = paperEntry(paper);
  const saved = isSaved(entry.id);
  const authors =
    paper.authors.length > 4 ? `${paper.authors.slice(0, 3).join(", ")} e mais ${paper.authors.length - 3}` : paper.authors.join(", ");
  return (
    <article className={`news-card paper ${isRead(entry.id) ? "read" : ""}`}>
      <header className="news-meta">
        {paper.upvotes !== undefined && (
          <span className="votes" title="Votos no Hugging Face Papers">
            <ThumbsUp size={13} aria-hidden="true" /> {int(paper.upvotes)}
          </span>
        )}
        <span className="news-source">{paper.source === "hf" ? "HF Papers" : "arXiv"}</span>
        <time dateTime={paper.publishedAt}>{ago(paper.publishedAt)}</time>
        <button
          className="save-btn"
          onClick={() => toggleSaved(entry)}
          aria-pressed={saved}
          aria-label={saved ? "Remover dos salvos" : "Salvar"}
        >
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
        </button>
      </header>
      <a className="news-title" href={paper.link} target="_blank" rel="noreferrer" onClick={() => markRead(entry.id)}>
        {paper.title}
      </a>
      {authors && <p className="muted small">{authors}</p>}
      {paper.summary && <p className="news-summary">{paper.summary}</p>}
      <footer className="news-tags">
        {paper.categories.slice(0, 3).map(c => (
          <span key={c} className="tag">
            {AREA[c] ?? c}
          </span>
        ))}
        {paper.pdf && (
          <a className="tag link" href={paper.pdf} target="_blank" rel="noreferrer">
            PDF
          </a>
        )}
        {paper.githubRepo && (
          <a className="tag link" href={paper.githubRepo} target="_blank" rel="noreferrer">
            <Github size={12} aria-hidden="true" /> código
          </a>
        )}
      </footer>
    </article>
  );
}

export default function Papers() {
  const papers = usePapers();
  const [tab, setTab] = useState<"trending" | "latest">("trending");
  const [area, setArea] = useState<string | null>(null);
  const list =
    tab === "trending"
      ? (papers.data?.trending ?? [])
      : (papers.data?.latest ?? []).filter(p => !area || p.categories.includes(area));
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Artigos"
        title="Pesquisa recente em IA"
        sub="Os artigos mais votados do dia no Hugging Face Papers e os últimos envios ao arXiv nas áreas de IA, linguagem, aprendizado de máquina e visão. Títulos e resumos no original, em inglês."
        updatedAt={papers.data?.updatedAt}
        loading={papers.loading}
        onRefresh={papers.refresh}
      />
      {papers.error && !papers.data && <ErrorNotice error={papers.error} />}
      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Lista">
          <button aria-pressed={tab === "trending"} onClick={() => setTab("trending")}>
            Mais votados ({int(papers.data?.trending.length ?? 0)})
          </button>
          <button aria-pressed={tab === "latest"} onClick={() => setTab("latest")}>
            Últimos no arXiv ({int(papers.data?.latest.length ?? 0)})
          </button>
        </div>
        {tab === "latest" && (
          <div className="filter-chips" role="group" aria-label="Área">
            <button aria-pressed={area === null} onClick={() => setArea(null)}>
              Todas
            </button>
            {["cs.AI", "cs.CL", "cs.LG", "cs.CV"].map(a => (
              <button key={a} aria-pressed={area === a} onClick={() => setArea(area === a ? null : a)}>
                {AREA[a]}
              </button>
            ))}
          </div>
        )}
      </div>
      {!papers.data && papers.loading && <Loading />}
      {papers.data && !list.length && (
        <Empty>
          {tab === "latest"
            ? "O arXiv não respondeu ainda (ele limita consultas frequentes). A lista aparece na próxima coleta."
            : "Nenhum artigo em alta agora."}
        </Empty>
      )}
      <div className="news-list">
        {list.map(p => (
          <PaperCard key={`${p.source}-${p.id}`} paper={p} />
        ))}
      </div>
      <SourcesPanel sources={papers.data?.sources ?? []} />
    </div>
  );
}

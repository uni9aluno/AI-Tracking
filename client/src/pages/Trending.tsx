import { useState } from "react";
import { Download, Heart, Star } from "lucide-react";
import type { HubItem } from "@shared/types";
import { Empty, ErrorNotice, Loading, PageHeader, SourcesPanel } from "@/components/common";
import { useTrending } from "@/lib/api";
import { ago, int, short } from "@/lib/fmt";

const TASK: Record<string, string> = {
  "text-generation": "texto",
  "image-text-to-text": "texto + imagem",
  "text-to-image": "gera imagem",
  "image-to-image": "edita imagem",
  "text-to-video": "gera vídeo",
  "image-to-video": "imagem → vídeo",
  "text-to-speech": "voz",
  "automatic-speech-recognition": "transcrição",
  "feature-extraction": "embeddings",
  "any-to-any": "multimodal",
  gradio: "Gradio",
  docker: "Docker",
  static: "estático",
  streamlit: "Streamlit",
};

function HubList({ items }: { items: HubItem[] }) {
  if (!items.length) return <Empty>Nada em alta agora.</Empty>;
  return (
    <ol className="hub-list">
      {items.map((m, i) => (
        <li key={m.id}>
          <span className="num rank">{i + 1}</span>
          <span className="hub-main">
            <a href={m.url} target="_blank" rel="noreferrer">
              {m.id}
            </a>
            <span className="model-sub">
              {m.task && <span className="tag">{TASK[m.task] ?? m.task}</span>}
              {m.createdAt && <span className="muted">criado {ago(m.createdAt)}</span>}
            </span>
          </span>
          <span className="hub-stats">
            <span title="Curtidas">
              <Heart size={13} aria-hidden="true" /> {short(m.likes)}
            </span>
            {m.downloads !== null && (
              <span title="Downloads no último mês" className="hide-sm">
                <Download size={13} aria-hidden="true" /> {short(m.downloads)}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function Trending() {
  const trending = useTrending();
  const [tab, setTab] = useState<"repos" | "models" | "spaces">("repos");
  const data = trending.data;
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Em alta"
        title="O que a comunidade está usando"
        sub="Repositórios de IA criados nos últimos 30 dias com mais estrelas no GitHub, e os modelos e Spaces em alta no Hugging Face. Atualiza a cada 30 minutos."
        updatedAt={data?.updatedAt}
        loading={trending.loading}
        onRefresh={trending.refresh}
      />
      {trending.error && !data && <ErrorNotice error={trending.error} />}
      <div className="segmented" role="group" aria-label="Lista">
        <button aria-pressed={tab === "repos"} onClick={() => setTab("repos")}>
          GitHub
        </button>
        <button aria-pressed={tab === "models"} onClick={() => setTab("models")}>
          Modelos HF
        </button>
        <button aria-pressed={tab === "spaces"} onClick={() => setTab("spaces")}>
          Spaces HF
        </button>
      </div>
      {!data && trending.loading && <Loading />}
      {data && tab === "repos" && (
        <div className="repo-grid">
          {data.repos.length === 0 && <Empty>Nenhum repositório agora.</Empty>}
          {data.repos.map(r => (
            <a key={r.id} className="repo-card" href={r.url} target="_blank" rel="noreferrer">
              <span className="repo-head">
                <b>{r.name}</b>
                <span className="stars">
                  <Star size={14} aria-hidden="true" /> {int(r.stars)}
                </span>
              </span>
              {r.description && <span className="repo-desc">{r.description}</span>}
              <span className="model-sub">
                {r.language && <span className="tag">{r.language}</span>}
                {r.topics.slice(0, 3).map(t => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
                <span className="muted">criado {ago(r.createdAt)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
      {data && tab === "models" && (
        <section className="card">
          <HubList items={data.hfModels} />
        </section>
      )}
      {data && tab === "spaces" && (
        <section className="card">
          <HubList items={data.hfSpaces} />
        </section>
      )}
      <SourcesPanel sources={data?.sources ?? []} />
    </div>
  );
}

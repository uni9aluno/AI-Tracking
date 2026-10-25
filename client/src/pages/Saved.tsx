import { Trash2 } from "lucide-react";
import { Empty, PageHeader } from "@/components/common";
import { published } from "@/lib/fmt";
import { removeSaved, useSaved } from "@/lib/saved";

const KIND = { noticia: "Notícia", artigo: "Artigo", modelo: "Modelo" } as const;

export default function Saved() {
  const { saved } = useSaved();
  return (
    <div className="stack">
      <PageHeader
        eyebrow="Salvos"
        title="Para ler depois"
        sub="Fica guardado só neste navegador. Em janela anônima ou com os dados do site apagados, a lista some."
      />
      {saved.length === 0 && (
        <Empty>Nada salvo ainda. Use o marcador ao lado de uma notícia ou artigo.</Empty>
      )}
      <ul className="plain saved-list">
        {saved.map(s => (
          <li key={s.id} className="card saved-item">
            <span>
              <span className="news-meta">
                <span className="tag">{KIND[s.kind]}</span>
                <span className="news-source">{s.source}</span>
                <time dateTime={s.date}>{published(s.date)}</time>
              </span>
              <a className="news-title" href={s.link} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            </span>
            <button className="icon-btn" onClick={() => removeSaved(s.id)} aria-label="Remover dos salvos" title="Remover">
              <Trash2 size={17} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

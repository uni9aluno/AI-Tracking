import { Bookmark, BookmarkCheck, MessageSquare } from "lucide-react";
import { SOURCE_KIND_LABEL, TOPICS, type NewsItem } from "@shared/types";
import { ago, published } from "@/lib/fmt";
import { markRead, newsEntry, toggleSaved, useSaved } from "@/lib/saved";

const MAX_TOPICS = 3;

/** One story: source, time, title (marks it read), summary, topics and the other outlets that carried it. */
export default function NewsCard({
  item,
  compact = false,
  onTopic,
}: {
  item: NewsItem;
  compact?: boolean;
  onTopic?: (topic: NewsItem["topics"][number]) => void;
}) {
  const { isSaved, isRead } = useSaved();
  const entry = newsEntry(item);
  const saved = isSaved(entry.id);
  const read = isRead(entry.id);
  const topics = item.topics.filter(t => t !== "novidades" || item.topics.length === 1);
  return (
    <article className={`news-card ${read ? "read" : ""} ${compact ? "compact" : ""}`}>
      <header className="news-meta">
        <span className={`kind kind-${item.kind}`}>{SOURCE_KIND_LABEL[item.kind]}</span>
        <span className="news-source">{item.source}</span>
        {item.lang === "pt" && <span className="lang">PT</span>}
        <time dateTime={item.publishedAt} title={published(item.publishedAt)}>
          {ago(item.publishedAt)}
        </time>
        <button
          className="save-btn"
          onClick={() => toggleSaved(entry)}
          aria-pressed={saved}
          aria-label={saved ? "Remover dos salvos" : "Salvar"}
          title={saved ? "Remover dos salvos" : "Salvar"}
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
        onAuxClick={() => markRead(entry.id)}
      >
        {item.title}
      </a>
      {!compact && item.summary && <p className="news-summary">{item.summary}</p>}
      <footer className="news-tags">
        {topics.slice(0, compact ? 2 : MAX_TOPICS).map(t =>
          onTopic ? (
            <button key={t} className={`tag topic-${t}`} onClick={() => onTopic(t)}>
              {TOPICS[t]}
            </button>
          ) : (
            <span key={t} className={`tag topic-${t}`}>
              {TOPICS[t]}
            </span>
          )
        )}
        {item.alsoIn.length > 0 && (
          <span className="tag also" title={`Também em: ${item.alsoIn.join(", ")}`}>
            +{item.alsoIn.length} {item.alsoIn.length === 1 ? "fonte" : "fontes"}
          </span>
        )}
        {item.score !== undefined && (
          <span className="tag also" title="Pontos no Hacker News">
            <MessageSquare size={12} aria-hidden="true" /> {item.score}
          </span>
        )}
      </footer>
    </article>
  );
}

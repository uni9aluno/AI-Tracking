import type { ReactNode } from "react";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";
import type { SourceStatus } from "@shared/types";
import { ago, int } from "@/lib/fmt";

/** Title block of every page, with collection time and a manual refresh. */
export function PageHeader(props: {
  eyebrow: string;
  title: string;
  sub?: ReactNode;
  updatedAt?: string | null;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{props.eyebrow}</p>
        <h1>{props.title}</h1>
        {props.sub && <p className="page-sub">{props.sub}</p>}
      </div>
      {props.onRefresh && (
        <div className="page-actions">
          {props.updatedAt && (
            <span className="muted small">atualizado {ago(props.updatedAt)}</span>
          )}
          <button
            className="icon-btn"
            onClick={props.onRefresh}
            aria-label="Atualizar agora"
            title="Atualizar agora"
            disabled={props.loading}
          >
            <RefreshCw size={17} className={props.loading ? "spin" : ""} />
          </button>
        </div>
      )}
    </div>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label={label}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

export function ErrorNotice({ error }: { error: string }) {
  return (
    <div className="notice bad" role="alert">
      <AlertTriangle size={18} />
      <span>
        Não foi possível falar com o servidor ({error}). A página tenta de novo
        sozinha a cada 5 minutos.
      </span>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty muted">{children}</p>;
}

const STATUS_LABEL = { ok: "ok", empty: "sem itens", error: "erro" } as const;
const STATUS_TONE = { ok: "ok", empty: "", error: "bad" } as const;

/** Collapsible per-source health list; the summary flags failing sources. */
export function SourcesPanel({ sources }: { sources: SourceStatus[] }) {
  if (!sources.length) return null;
  const failing = sources.filter(s => s.status === "error").length;
  return (
    <details className="card disclosure sources">
      <summary>
        <span>
          Fontes ({sources.length})
          {failing > 0 && <span className="chip bad sm">{failing} com erro</span>}
        </span>
        <ChevronDown size={18} className="chev" aria-hidden="true" />
      </summary>
      <ul className="plain source-list">
        {sources.map(s => (
          <li key={s.id}>
            <a href={s.url} rel="noreferrer" target="_blank">
              {s.label}
            </a>
            <span className="source-meta">
              {s.itemCount !== undefined && <span className="muted">{int(s.itemCount)} itens</span>}
              <span className="muted">{ago(s.fetchedAt)}</span>
              <span className={`chip sm ${STATUS_TONE[s.status]}`} title={s.message}>
                {STATUS_LABEL[s.status]}
                {s.message ? `: ${s.message}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Pill buttons that toggle one value of a filter; "Todos" clears it. */
export function FilterChips<T extends string>(props: {
  label: string;
  options: { id: T; label: string; count?: number }[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className="filter-row">
      <span className="filter-label">{props.label}</span>
      <div className="filter-chips" role="group" aria-label={props.label}>
        <button aria-pressed={props.value === null} onClick={() => props.onChange(null)}>
          Todos
        </button>
        {props.options.map(o => (
          <button
            key={o.id}
            aria-pressed={props.value === o.id}
            onClick={() => props.onChange(props.value === o.id ? null : o.id)}
          >
            {o.label}
            {o.count !== undefined && <span className="count">{int(o.count)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

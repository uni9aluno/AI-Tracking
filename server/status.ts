import type { FeedStatus, SourceStatus } from "../shared/types";

type Section = {
  situacao: FeedStatus | "indisponivel";
  atualizadoEm: string | null;
  itens: number;
  fontesComErro: string[];
};

export type PublicStatus = { geradoEm: string } & Record<string, Section>;

/**
 * Public, password-free summary (README): counts and source health only; no titles, links or settings.
 */
export function summarize(
  sections: Record<
    string,
    { status: FeedStatus; updatedAt: string; sources: SourceStatus[]; count: number } | null
  >,
  now = new Date()
): PublicStatus {
  const result: PublicStatus = { geradoEm: now.toISOString() } as PublicStatus;
  for (const [name, value] of Object.entries(sections)) {
    result[name] = value
      ? {
          situacao: value.status,
          atualizadoEm: value.updatedAt,
          itens: value.count,
          fontesComErro: value.sources
            .filter(s => s.status === "error")
            .map(s => s.id),
        }
      : { situacao: "indisponivel", atualizadoEm: null, itens: 0, fontesComErro: [] };
  }
  return result;
}

export type LiveState =
  "carregando" | "ao-vivo" | "parcial" | "desatualizado" | "offline";

// Collections run every 5 min; two missed rounds plus a margin means the panel is behind.
const STALE_MS = 12 * 60_000;

/**
 * One rule for every "AO VIVO" badge: no data yet is "carregando",
 * an error with nothing to show is "offline", a reading older than 12 min is "desatualizado".
 */
export function liveState(
  input: {
    hasData: boolean;
    loading: boolean;
    error: string | null;
    updatedAt: string | number | null;
    partial?: boolean;
  },
  now = Date.now()
): LiveState {
  if (!input.hasData) return input.error ? "offline" : "carregando";
  const time =
    typeof input.updatedAt === "number"
      ? input.updatedAt
      : input.updatedAt
        ? Date.parse(input.updatedAt)
        : NaN;
  if (input.error || !Number.isFinite(time) || now - time > STALE_MS)
    return "desatualizado";
  return input.partial ? "parcial" : "ao-vivo";
}

export const LIVE_LABEL: Record<LiveState, string> = {
  carregando: "CARREGANDO",
  "ao-vivo": "AO VIVO",
  parcial: "PARCIAL",
  desatualizado: "DESATUALIZADO",
  offline: "OFFLINE",
};

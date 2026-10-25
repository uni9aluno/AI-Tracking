const decimal = (digits: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const integer = new Intl.NumberFormat("pt-BR");
const compact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "1.234.567" */
export const int = (value: number) => integer.format(value);
export const num = (value: number, digits = 1) => decimal(digits).format(value);
/** "12,3 mil", "1,2 mi" */
export const short = (value: number) => compact.format(value);

/** "US$ 2,50" per million tokens; "grátis" for zero; "varia" when unknown. */
export function price(value: number | null) {
  if (value === null) return "varia";
  if (value === 0) return "grátis";
  return `US$ ${decimal(value < 0.1 ? 3 : 2).format(value)}`;
}

/** Context window: "128 mil", "1 mi" tokens. */
export function tokens(value: number | null) {
  if (!value) return "—";
  if (value >= 1_000_000) return `${num(value / 1_000_000, value % 1_000_000 ? 1 : 0)} mi`;
  return `${int(Math.round(value / 1000))} mil`;
}

/** "hoje 17:01" or "23/10 22:10"; "—" when the date is invalid. */
export function published(value: string, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return date.toDateString() === now.toDateString()
    ? `hoje ${time}`
    : `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

/** "25 de out." A bare "YYYY-MM-DD" is a calendar day, not UTC midnight (which is the day before in Brasília). */
export const day = (value: string) => {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
};

/** "20 de out. de 2026", for dates that may be years old (research posts). */
export const fullDay = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
};

/** "agora", "há 4 min", "há 3 h", "há 2 dias". */
export function ago(value: string | number, now = Date.now()) {
  const time = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const minutes = Math.max(0, Math.round((now - time) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} dias`;
}

export const plural = (count: number, one: string, many: string) =>
  `${int(count)} ${count === 1 ? one : many}`;

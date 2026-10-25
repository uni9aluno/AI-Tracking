const USER_AGENT = "RadarIA/1.0 (painel pessoal)";
const DEFAULT_TIMEOUT_MS = 15_000;

export type Fetched<T> = { body: T; latencyMs: number };

async function request(url: string, accept: string, timeoutMs: number) {
  const started = Date.now();
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept,
  };
  // GitHub allows 10 search calls/min without a token, 30 with a free one.
  if (url.startsWith("https://api.github.com/") && process.env.GITHUB_TOKEN)
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { response, started };
}

export async function fetchText(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Fetched<string>> {
  const { response, started } = await request(
    url,
    "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    timeoutMs
  );
  const body = await response.text();
  return { body, latencyMs: Date.now() - started };
}

export async function fetchJson<T>(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Fetched<T>> {
  const { response, started } = await request(
    url,
    "application/json",
    timeoutMs
  );
  const body = (await response.json()) as T;
  return { body, latencyMs: Date.now() - started };
}

export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.name === "TimeoutError"
      ? "tempo esgotado"
      : error.message
    : "falha desconhecida";

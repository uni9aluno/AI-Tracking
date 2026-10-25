import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60_000;

const digest = (value: string) => createHash("sha256").update(value).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

// /api/health is the host's health check; /api/status is a summary of public figures (README §10.2).
export const OPEN_PATHS = new Set(["/api/health", "/api/status"]);

// HTTP Basic gate for cloud hosting. Without a password the app stays open (local use).
export function accessGate(password: string | undefined, user = "radar") {
  if (!password)
    return (_req: Request, _res: Response, next: NextFunction) => next();
  const failures = new Map<string, { count: number; since: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    if (OPEN_PATHS.has(req.path)) return next();
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const entry = failures.get(key);
    if (entry && now - entry.since > WINDOW_MS) failures.delete(key);
    const current = failures.get(key);
    if (current && current.count >= MAX_FAILURES)
      return void res
        .status(429)
        .type("text/plain")
        .send("Muitas tentativas. Tente novamente em alguns minutos.");
    const header = req.headers.authorization ?? "";
    if (header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
      const split = decoded.indexOf(":");
      if (
        split >= 0 &&
        same(decoded.slice(0, split), user) &&
        same(decoded.slice(split + 1), password)
      )
        return next();
      failures.set(key, {
        count: (current?.count ?? 0) + 1,
        since: current?.since ?? now,
      });
    }
    res
      .set("WWW-Authenticate", 'Basic realm="Radar IA", charset="UTF-8"')
      .status(401)
      .type("text/plain")
      .send("Autenticação necessária.");
  };
}

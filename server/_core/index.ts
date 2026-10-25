import "dotenv/config";
import express from "express";
import fs from "node:fs";
import { createServer } from "http";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { Collector } from "../lib/collector";
import { buildOverview } from "../overview";
import { COLLECTORS, startScheduler } from "../scheduler";
import { summarize } from "../status";
import { accessGate } from "./accessGate";
import { serveStatic } from "./static";

const GUIDE_PATH = path.resolve(process.cwd(), "data", "guia.json");
// The first request after a restart waits at most this long for a collection; later ones read the cache.
const FIRST_COLLECTION_WAIT_MS = 12_000;

/** JSON, gzipped when the browser accepts it (the news list is ~1 MB raw). */
function sendJson(req: express.Request, res: express.Response, value: unknown) {
  const body = Buffer.from(JSON.stringify(value));
  res.set("Cache-Control", "no-store").type("application/json");
  if (body.length > 1024 && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
    res.set("Content-Encoding", "gzip").set("Vary", "Accept-Encoding");
    return void res.send(gzipSync(body));
  }
  res.send(body);
}

async function current<T>(collector: Collector<T>) {
  const cached = collector.peek();
  if (cached) return cached;
  return Promise.race([
    collector.get(),
    new Promise<null>(resolve =>
      setTimeout(() => resolve(null), FIRST_COLLECTION_WAIT_MS).unref()
    ),
  ]).catch(() => null);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Behind a hosting proxy (Render) req.ip must come from X-Forwarded-For.
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(accessGate(process.env.APP_PASSWORD, process.env.APP_USER));
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  const routes: [string, Collector<unknown>][] = [
    ["/api/news", COLLECTORS.news],
    ["/api/models", COLLECTORS.models],
    ["/api/papers", COLLECTORS.papers],
    ["/api/trending", COLLECTORS.trending],
    ["/api/benchmarks", COLLECTORS.benchmarks],
    ["/api/api-status", COLLECTORS.apiStatus],
    ["/api/research", COLLECTORS.research],
  ];
  for (const [route, collector] of routes) {
    app.get(route, async (req, res) => {
      try {
        sendJson(req, res, await collector.get(req.query.refresh === "1"));
      } catch (error) {
        res.status(502).json({
          error: error instanceof Error ? error.message : "Fonte indisponível",
        });
      }
    });
  }

  app.get("/api/overview", async (req, res) => {
    const [news, models, papers, trending, benchmarks, apiStatus] =
      await Promise.all([
        current(COLLECTORS.news),
        current(COLLECTORS.models),
        current(COLLECTORS.papers),
        current(COLLECTORS.trending),
        current(COLLECTORS.benchmarks),
        current(COLLECTORS.apiStatus),
      ]);
    sendJson(
      req,
      res,
      buildOverview({ news, models, papers, trending, benchmarks, apiStatus })
    );
  });

  app.get("/api/guide", (req, res) => {
    try {
      sendJson(req, res, JSON.parse(fs.readFileSync(GUIDE_PATH, "utf8")));
    } catch {
      res.status(500).json({ error: "data/guia.json ilegível" });
    }
  });

  // Open route (see accessGate): counts and source health only.
  app.get("/api/status", (_req, res) => {
    const c = COLLECTORS;
    const news = c.news.peek();
    const models = c.models.peek();
    const papers = c.papers.peek();
    const trending = c.trending.peek();
    const benchmarks = c.benchmarks.peek();
    const apiStatus = c.apiStatus.peek();
    const research = c.research.peek();
    res.set("Cache-Control", "no-store").json(
      summarize({
        noticias: news && { ...news, count: news.items.length },
        modelos: models && { ...models, count: models.models.length },
        artigos: papers && { ...papers, count: papers.latest.length + papers.trending.length },
        emAlta: trending && { ...trending, count: trending.repos.length + trending.hfModels.length + trending.hfSpaces.length },
        benchmarks: benchmarks && { ...benchmarks, count: benchmarks.arenas.length },
        statusApis: apiStatus && { ...apiStatus, count: apiStatus.services.length },
        pesquisa: research && { ...research, count: research.providers.reduce((n, p) => n + p.items.length, 0) },
      })
    );
  });

  // Unknown /api paths answer JSON instead of the SPA shell.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    // A non-literal specifier keeps esbuild from bundling vite into the production build.
    const viteModule = "./vite";
    const { setupVite } = (await import(viteModule)) as typeof import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) return next(error);
      console.error(error);
      res.status(500).json({ error: "Internal error" });
    }
  );

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  // Loopback by default: this machine's firewall lets node through on the Tailscale interface.
  // Set HOST=0.0.0.0 to serve the LAN deliberately (render.yaml does, since the host needs it).
  const host = process.env.HOST || "127.0.0.1";
  server.on("error", error => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
    if (process.env.DISABLE_SCHEDULER !== "1") startScheduler();
  });
}

startServer().catch(error => {
  console.error(error);
  process.exit(1);
});

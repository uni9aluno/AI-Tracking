import fs from "node:fs";
import path from "node:path";

/** Collected history survives restarts here (local use); Render's disk is ephemeral. */
export const CACHE_DIR = path.resolve(
  process.env.DATA_DIR || path.join(process.cwd(), "data", "cache")
);

export function readCache<T>(name: string): T | null {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(CACHE_DIR, `${name}.json`), "utf8")
    ) as T;
  } catch {
    return null;
  }
}

/** Write to a temporary file, then rename, so a crash never leaves half a JSON behind. */
export function writeCache(name: string, value: unknown) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const target = path.join(CACHE_DIR, `${name}.json`);
    const temp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value));
    fs.renameSync(temp, target);
  } catch (error) {
    console.error(
      `[cache] não foi possível gravar ${name}:`,
      error instanceof Error ? error.message : error
    );
  }
}

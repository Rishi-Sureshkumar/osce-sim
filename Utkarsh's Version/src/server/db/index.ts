import "server-only";
import { FileRepo } from "./fileRepo";
import type { Repo } from "./repo";

let repo: Repo | null = null;

/** Postgres when DATABASE_URL is set, otherwise a local JSON file (dev only). */
export async function getRepo(): Promise<Repo> {
  if (repo) return repo;
  const url = process.env.DATABASE_URL;
  if (url) {
    const { PgRepo } = await import("./pgRepo");
    repo = new PgRepo(url);
  } else {
    if (process.env.VERCEL) {
      throw new Error("DATABASE_URL is required on Vercel (the file store is for local development only).");
    }
    repo = new FileRepo();
  }
  return repo;
}

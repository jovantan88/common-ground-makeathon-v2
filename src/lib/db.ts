import "server-only";
import { createHash } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { PRESETS } from "@/data/presets";
import { normalizeStory, summarize, type Research, type Story, type StorySummary } from "./schemas";

/**
 * Storage for stories, generated images and cached surname research.
 *
 * Uses Neon Postgres when DATABASE_URL is set. Without it, everything lives in
 * process memory so the app still runs locally (data is lost on restart).
 * Built-in preset sagas are always available and are upserted into Neon as
 * featured stories on first connection.
 */
export interface Repo {
  readonly kind: "neon" | "memory";
  getStory(id: string): Promise<{ story: Story; ownerHash: string | null } | null>;
  /** Create or update. Returns false if the story exists and the token doesn't match. */
  saveStory(story: Story, ownerToken: string): Promise<boolean>;
  listStories(limit?: number): Promise<StorySummary[]>;
  saveImage(id: string, storyId: string | null, mime: string, data: Buffer): Promise<void>;
  getImage(id: string): Promise<{ mime: string; data: Buffer } | null>;
  getResearch(key: string): Promise<Research | null>;
  saveResearch(key: string, research: Research): Promise<void>;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/* ------------------------------------------------------------------ */
/* Neon                                                                */
/* ------------------------------------------------------------------ */

export class NeonRepo implements Repo {
  readonly kind = "neon" as const;
  private ready: Promise<void> | null = null;

  constructor(private sql: NeonQueryFunction<false, false>) {}

  private init() {
    this.ready ??= (async () => {
      const sql = this.sql;
      await sql`CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        owner_hash TEXT,
        surname TEXT NOT NULL,
        title TEXT NOT NULL,
        data JSONB NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT false,
        is_featured BOOLEAN NOT NULL DEFAULT false,
        page_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS stories_gallery_idx
        ON stories (is_featured DESC, updated_at DESC) WHERE is_public OR is_featured`;
      await sql`CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        story_id TEXT,
        mime TEXT NOT NULL,
        data_b64 TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS surname_research (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Seed / refresh the built-in featured sagas, and retire ones that were removed from the repo.
      await sql`DELETE FROM stories WHERE is_featured AND owner_hash IS NULL AND NOT (id = ANY(${PRESETS.map((p) => p.id)}))`;
      for (const preset of PRESETS) {
        await sql`INSERT INTO stories (id, owner_hash, surname, title, data, is_public, is_featured, page_count, created_at)
          VALUES (${preset.id}, NULL, ${preset.hero.surname}, ${preset.title}, ${JSON.stringify(preset)}::jsonb,
                  true, true, ${preset.pages.length}, ${preset.createdAt})
          ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, title = EXCLUDED.title,
            page_count = EXCLUDED.page_count, is_featured = true, is_public = true`;
      }
    })().catch((err) => {
      this.ready = null;
      throw err;
    });
    return this.ready;
  }

  async getStory(id: string) {
    await this.init();
    const rows = await this.sql`SELECT data, owner_hash, is_public, is_featured FROM stories WHERE id = ${id}`;
    if (!rows[0]) return null;
    const story = normalizeStory({
      ...(rows[0].data as Story),
      isPublic: rows[0].is_public,
      isFeatured: rows[0].is_featured,
    });
    return { story, ownerHash: rows[0].owner_hash as string | null };
  }

  async saveStory(story: Story, ownerToken: string) {
    await this.init();
    const hash = hashToken(ownerToken);
    const data = JSON.stringify({ ...story, isFeatured: false });
    // Insert, or update only when the caller owns the row.
    const rows = await this.sql`
      INSERT INTO stories (id, owner_hash, surname, title, data, is_public, page_count)
      VALUES (${story.id}, ${hash}, ${story.hero.surname}, ${story.title}, ${data}::jsonb, ${story.isPublic}, ${story.pages.length})
      ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data, title = EXCLUDED.title, is_public = EXCLUDED.is_public,
        page_count = EXCLUDED.page_count, updated_at = now()
      WHERE stories.owner_hash = ${hash}
      RETURNING id`;
    return rows.length > 0;
  }

  async listStories(limit = 24) {
    await this.init();
    const rows = await this.sql`
      SELECT data, is_featured FROM stories
      WHERE (is_public OR is_featured) AND page_count > 0
      ORDER BY is_featured DESC, updated_at DESC
      LIMIT ${limit}`;
    return rows.map((r) => summarize({ ...(r.data as Story), isFeatured: r.is_featured }));
  }

  async saveImage(id: string, storyId: string | null, mime: string, data: Buffer) {
    await this.init();
    await this.sql`INSERT INTO images (id, story_id, mime, data_b64)
      VALUES (${id}, ${storyId}, ${mime}, ${data.toString("base64")})`;
  }

  async getImage(id: string) {
    await this.init();
    const rows = await this.sql`SELECT mime, data_b64 FROM images WHERE id = ${id}`;
    if (!rows[0]) return null;
    return { mime: rows[0].mime as string, data: Buffer.from(rows[0].data_b64 as string, "base64") };
  }

  async getResearch(key: string) {
    await this.init();
    const rows = await this.sql`SELECT data FROM surname_research WHERE key = ${key}`;
    return (rows[0]?.data as Research) ?? null;
  }

  async saveResearch(key: string, research: Research) {
    await this.init();
    await this.sql`INSERT INTO surname_research (key, data) VALUES (${key}, ${JSON.stringify(research)}::jsonb)
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, created_at = now()`;
  }
}

/* ------------------------------------------------------------------ */
/* In-memory fallback                                                  */
/* ------------------------------------------------------------------ */

export class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  private stories = new Map<string, { story: Story; ownerHash: string | null }>();
  private images = new Map<string, { mime: string; data: Buffer }>();
  private research = new Map<string, Research>();

  constructor() {
    for (const preset of PRESETS) {
      this.stories.set(preset.id, { story: { ...preset, isFeatured: true, isPublic: true }, ownerHash: null });
    }
  }

  async getStory(id: string) {
    const found = this.stories.get(id);
    return found ? { ...found, story: normalizeStory(found.story) } : null;
  }

  async saveStory(story: Story, ownerToken: string) {
    const hash = hashToken(ownerToken);
    const existing = this.stories.get(story.id);
    if (existing && existing.ownerHash !== hash) return false;
    this.stories.set(story.id, { story: { ...story, isFeatured: false }, ownerHash: hash });
    return true;
  }

  async listStories(limit = 24) {
    return [...this.stories.values()]
      .map((s) => s.story)
      .filter((s) => (s.isPublic || s.isFeatured) && s.pages.length > 0)
      .sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(summarize);
  }

  async saveImage(id: string, _storyId: string | null, mime: string, data: Buffer) {
    this.images.set(id, { mime, data });
  }

  async getImage(id: string) {
    return this.images.get(id) ?? null;
  }

  async getResearch(key: string) {
    return this.research.get(key) ?? null;
  }

  async saveResearch(key: string, research: Research) {
    this.research.set(key, research);
  }
}

/* ------------------------------------------------------------------ */

const globalForRepo = globalThis as unknown as { __sagaRepo?: Repo };

export function repo(): Repo {
  if (!globalForRepo.__sagaRepo) {
    const url = process.env.DATABASE_URL;
    globalForRepo.__sagaRepo = url ? new NeonRepo(neon(url)) : new MemoryRepo();
    if (!url) console.warn("[db] DATABASE_URL not set — using in-memory storage (data resets on restart).");
  }
  return globalForRepo.__sagaRepo;
}

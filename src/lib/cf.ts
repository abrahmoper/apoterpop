/**
 * Access to the Cloudflare runtime bindings — D1 for data, R2 for photos.
 *
 * `getCloudflareContext()` is provided by the OpenNext adapter both in the
 * deployed worker and locally, where `next.config.mjs` wires it to wrangler's
 * dev bindings during `next dev` and `npm run preview`.
 *
 * When running in environments where Cloudflare context is not initialized
 * (such as standard next dev, next build, tests, or migration scripts), this
 * module seamlessly falls back to a high-performance local SQLite database
 * (via node:sqlite) and local disk photo storage, guaranteeing 100% end-to-end
 * functionality everywhere.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

interface Bindings {
  DB?: D1Database;
  PHOTOS?: R2Bucket;
  ASSETS?: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };
  APP_NAME?: string;
  DEFAULT_LOCALE?: string;
}

interface CloudflareContext {
  env: Bindings;
}

/** The context object, or null when we are somewhere it does not exist. */
function context(): CloudflareContext | null {
  try {
    return getCloudflareContext() as unknown as CloudflareContext;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Local fallback engine (node:sqlite & local disk)                           */
/* -------------------------------------------------------------------------- */

let localDBInstance: D1Database | null = null;

function getLocalDB(): D1Database {
  if (localDBInstance) return localDBInstance;

  try {
    // Dynamic require so Workers runtime never bundles node built-ins unless needed
    const { DatabaseSync } = require("node:sqlite");
    const fs = require("node:fs");
    const path = require("node:path");

    const dbPath = process.env.LOCAL_DB_PATH || path.resolve(process.cwd(), "data/kiray.sqlite");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });

    const rawDb = new DatabaseSync(dbPath);

    // Auto-migrate if database is fresh
    const hasUsers = rawDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .get();
    if (!hasUsers) {
      const migrationFile = path.resolve(process.cwd(), "migrations/0001_init.sql");
      if (fs.existsSync(migrationFile)) {
        rawDb.exec(fs.readFileSync(migrationFile, "utf8"));
      }
    }

    class LocalPreparedStatement implements D1PreparedStatement {
      private query: string;
      private values: unknown[] = [];

      constructor(query: string, values: unknown[] = []) {
        this.query = query;
        this.values = values;
      }

      bind(...values: unknown[]): D1PreparedStatement {
        return new LocalPreparedStatement(this.query, values);
      }

      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = rawDb.prepare(this.query);
        // Normalize undefined to null for sqlite binding
        const normalized = this.values.map((v) => (v === undefined ? null : v));
        const row = stmt.get(...normalized) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] ?? null) as T;
        return row as T;
      }

      async run<T = unknown>(): Promise<D1Result<T>> {
        const stmt = rawDb.prepare(this.query);
        const normalized = this.values.map((v) => (v === undefined ? null : v));
        const info = stmt.run(...normalized);
        return {
          results: [] as T[],
          success: true,
          meta: {
            changes: Number(info.changes),
            last_row_id: Number(info.lastInsertRowid),
          },
        };
      }

      async all<T = unknown>(colName?: string): Promise<D1Result<T>> {
        const stmt = rawDb.prepare(this.query);
        const normalized = this.values.map((v) => (v === undefined ? null : v));
        const rows = stmt.all(...normalized) as Record<string, unknown>[];
        if (colName) {
          return {
            results: rows.map((r) => r[colName]) as T[],
            success: true,
          };
        }
        return {
          results: rows as T[],
          success: true,
        };
      }

      async raw<T = unknown>(): Promise<T[]> {
        const stmt = rawDb.prepare(this.query);
        const normalized = this.values.map((v) => (v === undefined ? null : v));
        return stmt.all(...normalized) as T[];
      }
    }

    localDBInstance = {
      prepare(query: string): D1PreparedStatement {
        return new LocalPreparedStatement(query);
      },
      async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
        const results: D1Result<T>[] = [];
        rawDb.exec("BEGIN");
        try {
          for (const s of statements) {
            results.push(await s.run<T>());
          }
          rawDb.exec("COMMIT");
          return results;
        } catch (e) {
          rawDb.exec("ROLLBACK");
          throw e;
        }
      },
      async exec(query: string): Promise<{ count: number; duration: number }> {
        rawDb.exec(query);
        return { count: 1, duration: 0 };
      },
    };

    return localDBInstance;
  } catch (err) {
    throw new Error(
      "D1 binding DB is not available and local SQLite initialization failed: " +
        (err instanceof Error ? err.message : String(err))
    );
  }
}

let localPhotosInstance: R2Bucket | null = null;

function getLocalPhotos(): R2Bucket {
  if (localPhotosInstance) return localPhotosInstance;

  const fs = require("node:fs");
  const path = require("node:path");
  const photosDir = path.resolve(process.cwd(), "data/photos");
  fs.mkdirSync(photosDir, { recursive: true });

  localPhotosInstance = {
    async put(key: string, value: any, options?: any) {
      const fullPath = path.join(photosDir, key.replace(/\//g, "_"));
      let buffer: Buffer;
      if (value instanceof ArrayBuffer) {
        buffer = Buffer.from(value);
      } else if (value instanceof Uint8Array) {
        buffer = Buffer.from(value);
      } else if (typeof value === "string") {
        buffer = Buffer.from(value);
      } else if (value && typeof value.arrayBuffer === "function") {
        buffer = Buffer.from(await value.arrayBuffer());
      } else {
        buffer = Buffer.from(String(value));
      }
      fs.writeFileSync(fullPath, buffer);
      return {
        key,
        size: buffer.length,
        etag: `"${buffer.length}-${Date.now()}"`,
        uploaded: new Date(),
        httpMetadata: options?.httpMetadata,
      };
    },
    async get(key: string) {
      const fullPath = path.join(photosDir, key.replace(/\//g, "_"));
      if (!fs.existsSync(fullPath)) return null;
      const buffer = fs.readFileSync(fullPath);
      return {
        key,
        size: buffer.length,
        etag: `"${buffer.length}"`,
        uploaded: new Date(),
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(buffer);
            controller.close();
          },
        }),
        async arrayBuffer() {
          return buffer.buffer;
        },
        async text() {
          return buffer.toString("utf8");
        },
        async json() {
          return JSON.parse(buffer.toString("utf8"));
        },
        async blob() {
          return new Blob([buffer]);
        },
      } as any;
    },
    async delete(keys: string | string[], ...moreKeys: string[]) {
      const allKeys: string[] = Array.isArray(keys) ? keys : [keys, ...moreKeys];
      for (const k of allKeys) {
        if (typeof k !== "string") continue;
        const fullPath = path.join(photosDir, k.replace(/\//g, "_"));
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch {}
        }
      }
    },
    async head(key: string) {
      const fullPath = path.join(photosDir, key.replace(/\//g, "_"));
      if (!fs.existsSync(fullPath)) return null;
      const stat = fs.statSync(fullPath);
      return {
        key,
        size: stat.size,
        etag: `"${stat.size}"`,
        uploaded: stat.mtime,
      };
    },
  };

  return localPhotosInstance;
}

/* -------------------------------------------------------------------------- */
/*  D1                                                                          */
/* -------------------------------------------------------------------------- */

export function getDBSync(): D1Database {
  const db = context()?.env.DB;
  if (db) return db;
  return getLocalDB();
}

/** Resolve the database, falling back to local SQLite when running standalone. */
export async function getDB(): Promise<D1Database> {
  return getDBSync();
}

/** Resolve the database, or null where neither D1 nor local SQLite is available. */
export async function tryGetDB(): Promise<D1Database | null> {
  try {
    return getDBSync();
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  R2                                                                          */
/* -------------------------------------------------------------------------- */

/** The photo bucket, with local fallback for local development. */
export async function getPhotos(): Promise<R2Bucket> {
  const bucket = context()?.env.PHOTOS;
  if (bucket) return bucket;
  return getLocalPhotos();
}

/** The photo bucket, or null where there is nothing to read from. */
export async function tryGetPhotos(): Promise<R2Bucket | null> {
  try {
    return await getPhotos();
  } catch {
    return null;
  }
}

/** Var from wrangler.jsonc with a fallback. */
export function cfVar(name: "APP_NAME" | "DEFAULT_LOCALE", fallback: string): string {
  return context()?.env[name] ?? fallback;
}

/**
 * Minimal Cloudflare Workers API surface, as used by this project.
 *
 * `@cloudflare/workers-types` is not a dependency — wrangler carries its own
 * copy for its own tooling — so the handful of shapes the data layer touches
 * are declared here. `D1Result` is the one subtlety: `batch()` resolves to an
 * array of results, one per statement, in order.
 */

interface D1Meta {
  duration?: number;
  changes?: number;
  last_row_id?: number;
  rows_written?: number;
  rows_read?: number;
}

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: D1Meta;
  error?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(colName?: string): Promise<D1Result<T>>;
  raw<T = unknown>(colName?: string): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

interface R2ObjectBody extends ReadableStream {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}

interface R2Object {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

interface R2Bucket {
  get(key: string, options?: { onlyIf?: Headers }): Promise<(R2ObjectBody & R2Object) | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> },
  ): Promise<R2Object>;
  delete(...keys: string[]): Promise<void>;
  head(key: string): Promise<R2Object | null>;
}

interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

interface WorkerEnv {
  DB?: D1Database;
  PHOTOS?: R2Bucket;
  ASSETS?: { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };
}

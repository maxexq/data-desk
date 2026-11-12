// The slice of Cloudflare's D1 API the server uses, so tests can run it on node:sqlite.
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Like {
  prepare(sql: string): D1Statement;
}

export interface Env {
  DB: D1Like;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/** What a Pages Function receives (only the parts used here). */
export interface Context {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}

/** Side effects, passed in so tests control them. */
export interface Deps {
  fetch: typeof fetch;
  now: () => number;
}

export const realDeps = (): Deps => ({ fetch: (input, init) => fetch(input, init), now: () => Date.now() });

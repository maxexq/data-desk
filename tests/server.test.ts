// The login backend, run against real SQLite (node:sqlite stands in for D1) and a fake Google / GitHub.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { callback, login, logout, me, progress, SESSION_COOKIE } from '../server/api';
import type { D1Like, D1Statement, Deps, Env } from '../server/types';

const ORIGIN = 'https://data-desk.pages.dev';

function d1(): D1Like {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../migrations/0001_accounts.sql', import.meta.url), 'utf8'));
  return {
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt: D1Statement = {
        bind: (...v) => ((args = v), stmt),
        first: async <T,>() => ((db.prepare(sql).get(...(args as never[])) as T) ?? null),
        run: async () => db.prepare(sql).run(...(args as never[])),
      };
      return stmt;
    },
  };
}

let env: Env;
let now = 1_800_000_000_000;
const calls: string[] = [];

/** A pretend Google and GitHub that accept the code "good-code". */
const deps: Deps = {
  now: () => now,
  fetch: async (input, init) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/token') || url.includes('access_token')) {
      const form = new URLSearchParams(String(init?.body));
      if (form.get('code') !== 'good-code') return Response.json({ error: 'bad_verification_code' });
      if (!form.get('code_verifier')) return Response.json({ error: 'pkce' }, { status: 400 });
      return Response.json({ access_token: 'at-123' });
    }
    if (url.includes('userinfo')) return Response.json({ sub: 'g-42', name: 'Anya', picture: 'https://example.com/a.png' });
    if (url.includes('api.github.com/user')) return Response.json({ id: 7, login: 'octo', name: null, avatar_url: 'https://example.com/o.png' });
    return new Response('?', { status: 404 });
  },
};

const req = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  new Request(`${ORIGIN}${path}`, { ...init, headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers as Record<string, string>) } });

const setCookies = (r: Response) => r.headers.getSetCookie();
const cookieValue = (r: Response, name: string) => {
  const c = setCookies(r).find((x) => x.startsWith(`${name}=`));
  return c ? decodeURIComponent(c.split(';')[0].slice(name.length + 1)) : null;
};

/** Run the whole sign-in like a browser would, returning the session cookie. */
async function signIn(provider: 'google' | 'github') {
  const start = await login(req(`/api/auth/${provider}/login`), env, provider);
  const flow = cookieValue(start, 'dd_oauth')!;
  const state = new URL(start.headers.get('location')!).searchParams.get('state')!;
  const done = await callback(req(`/api/auth/${provider}/callback?code=good-code&state=${state}`, { cookie: `dd_oauth=${encodeURIComponent(flow)}` }), env, provider, deps);
  return { done, session: cookieValue(done, SESSION_COOKIE) };
}

beforeEach(() => {
  env = { DB: d1(), GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec', GITHUB_CLIENT_ID: 'hid', GITHUB_CLIENT_SECRET: 'hsec' };
  calls.length = 0;
});

describe('sign in', () => {
  it('sends the browser to Google with state, PKCE and no e-mail scope', async () => {
    const r = await login(req('/api/auth/google/login'), env, 'google');
    expect(r.status).toBe(302);
    const to = new URL(r.headers.get('location')!);
    expect(to.origin).toBe('https://accounts.google.com');
    expect(to.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/api/auth/google/callback`);
    expect(to.searchParams.get('scope')).toBe('openid profile');
    expect(to.searchParams.get('code_challenge_method')).toBe('S256');
    const flow = setCookies(r).find((c) => c.startsWith('dd_oauth='))!;
    expect(flow).toMatch(/HttpOnly/);
    expect(flow).toMatch(/Path=\/api\/auth/);
  });

  it('signs in with GitHub, creates the user once, and keeps the name current', async () => {
    const first = await signIn('github');
    expect(first.done.headers.get('location')).toBe(`${ORIGIN}/?login=github`);
    expect(first.session).toBeTruthy();
    const who = await (await me(req('/api/me', { cookie: `${SESSION_COOKIE}=${first.session}` }), env, deps)).json();
    expect(who.user).toMatchObject({ provider: 'github', name: 'octo' });
    expect(who.providers).toEqual(['google', 'github']);

    const second = await signIn('github');
    const again = await (await me(req('/api/me', { cookie: `${SESSION_COOKIE}=${second.session}` }), env, deps)).json();
    expect(again.user.id).toBe(who.user.id);
  });

  it('refuses a callback whose state does not match the browser', async () => {
    await login(req('/api/auth/google/login'), env, 'google');
    const r = await callback(req('/api/auth/google/callback?code=good-code&state=forged', { cookie: 'dd_oauth=google.real.verifier' }), env, 'google', deps);
    expect(r.headers.get('location')).toBe(`${ORIGIN}/?login_error=state`);
    expect(calls).toHaveLength(0); // never even asked Google
  });

  it('reports a rejected code and a cancelled consent screen', async () => {
    const start = await login(req('/api/auth/google/login'), env, 'google');
    const flow = cookieValue(start, 'dd_oauth')!;
    const state = flow.split('.')[1];
    const bad = await callback(req(`/api/auth/google/callback?code=nope&state=${state}`, { cookie: `dd_oauth=${flow}` }), env, 'google', deps);
    expect(bad.headers.get('location')).toBe(`${ORIGIN}/?login_error=provider`);
    const cancelled = await callback(req(`/api/auth/google/callback?error=access_denied&state=${state}`, { cookie: `dd_oauth=${flow}` }), env, 'google', deps);
    expect(cancelled.headers.get('location')).toBe(`${ORIGIN}/?login_error=cancelled`);
  });

  it('lists only the providers that have keys', async () => {
    env = { DB: env.DB, GITHUB_CLIENT_ID: 'hid', GITHUB_CLIENT_SECRET: 'hsec' };
    expect((await (await me(req('/api/me'), env, deps)).json()).providers).toEqual(['github']);
    const r = await login(req('/api/auth/google/login'), env, 'google');
    expect(r.headers.get('location')).toBe(`${ORIGIN}/?login_error=not_configured`);
  });
});

describe('sessions', () => {
  it('stores only a hash of the cookie value', async () => {
    const { session } = await signIn('google');
    const db = env.DB as D1Like;
    const row = await db.prepare('SELECT token_hash FROM sessions').first<{ token_hash: string }>();
    expect(row?.token_hash).not.toBe(session);
  });

  it('expires after 30 days, and log out ends it', async () => {
    const { session } = await signIn('google');
    const ask = () => me(req('/api/me', { cookie: `${SESSION_COOKIE}=${session}` }), env, deps).then((r) => r.json());
    expect((await ask()).user).not.toBeNull();
    now += 31 * 864e5;
    expect((await ask()).user).toBeNull();
    now -= 31 * 864e5;

    const out = await logout(req('/api/logout', { method: 'POST', cookie: `${SESSION_COOKIE}=${session}`, headers: { origin: ORIGIN } }), env);
    expect(out.status).toBe(200);
    expect(setCookies(out)[0]).toMatch(/Max-Age=0/);
    expect((await ask()).user).toBeNull();
  });
});

describe('progress', () => {
  it('saves and loads the game for the signed-in player only', async () => {
    const { session } = await signIn('google');
    const put = (body: string, origin = ORIGIN) =>
      progress(req('/api/progress', { method: 'PUT', body, cookie: `${SESSION_COOKIE}=${session}`, headers: { origin, 'content-type': 'application/json' } }), env, deps);

    expect((await progress(req('/api/progress'), env, deps)).status).toBe(401);
    expect(await (await progress(req('/api/progress', { cookie: `${SESSION_COOKIE}=${session}` }), env, deps)).json()).toEqual({ data: null, updatedAt: null });

    expect((await put(JSON.stringify({ data: { progress: { t01: { done: true } } } }))).status).toBe(200);
    const got = await (await progress(req('/api/progress', { cookie: `${SESSION_COOKIE}=${session}` }), env, deps)).json();
    expect(got).toEqual({ data: { progress: { t01: { done: true } } }, updatedAt: now });

    expect((await put('{"data":{}}', 'https://evil.example')).status).toBe(403); // another site cannot write
    expect((await put('{"data":[1]}')).status).toBe(400);
    expect((await put('not json')).status).toBe(400);
    expect((await put(JSON.stringify({ data: { notes: 'x'.repeat(300 * 1024) } }))).status).toBe(413);
  });
});

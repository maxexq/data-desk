// Request handlers behind the Pages Functions in functions/api. Plain functions: tests call them directly.
import { createSession, deleteSession, MAX_SAVE_BYTES, readSave, SESSION_DAYS, upsertUser, userForSession, writeSave } from './accounts';
import { cookie, json, randomToken, readCookie, redirect, sameOrigin } from './http';
import { authorizeUrl, callbackUrl, clientOf, fetchProfile, isProvider, OAuthError } from './oauth';
import type { Deps, Env } from './types';

export const SESSION_COOKIE = 'dd_session';
const FLOW_COOKIE = 'dd_oauth';
const FLOW_PATH = '/api/auth';

/** Back to the desktop, with a reason the game can show. */
const fail = (origin: string, reason: string) => redirect(`${origin}/?login_error=${encodeURIComponent(reason)}`, [cookie(FLOW_COOKIE, '', { maxAge: 0, path: FLOW_PATH })]);

export async function login(req: Request, env: Env, provider: unknown): Promise<Response> {
  const origin = new URL(req.url).origin;
  if (!isProvider(provider)) return json({ error: 'unknown provider' }, 404);
  const client = clientOf(env, provider);
  if (!client) return fail(origin, 'not_configured');
  const state = randomToken(16);
  const verifier = randomToken(32);
  const url = await authorizeUrl(provider, client.id, callbackUrl(origin, provider), state, verifier);
  // Remember which flow this browser started, for 10 minutes, only where the callback can read it.
  return redirect(url, [cookie(FLOW_COOKIE, `${provider}.${state}.${verifier}`, { maxAge: 600, path: FLOW_PATH })]);
}

export async function callback(req: Request, env: Env, provider: unknown, deps: Deps): Promise<Response> {
  const url = new URL(req.url);
  const origin = url.origin;
  if (!isProvider(provider)) return json({ error: 'unknown provider' }, 404);
  const client = clientOf(env, provider);
  if (!client) return fail(origin, 'not_configured');
  if (url.searchParams.get('error')) return fail(origin, 'cancelled');
  const [p, state, verifier] = (readCookie(req, FLOW_COOKIE) ?? '').split('.');
  const code = url.searchParams.get('code');
  // The state must be the one this browser was given: stops a login started by someone else.
  if (!code || !state || p !== provider || url.searchParams.get('state') !== state) return fail(origin, 'state');
  try {
    const profile = await fetchProfile(provider, client, code, callbackUrl(origin, provider), verifier, deps);
    const now = deps.now();
    const user = await upsertUser(env.DB, provider, profile, now);
    const token = await createSession(env.DB, user.id, now);
    return redirect(`${origin}/?login=${provider}`, [
      cookie(FLOW_COOKIE, '', { maxAge: 0, path: FLOW_PATH }),
      cookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 86400 }),
    ]);
  } catch (e) {
    return fail(origin, e instanceof OAuthError ? 'provider' : 'server');
  }
}

/** Who is signed in, and which providers this deployment offers. */
export async function me(req: Request, env: Env, deps: Deps): Promise<Response> {
  const user = await userForSession(env.DB, readCookie(req, SESSION_COOKIE), deps.now());
  const providers = (['google', 'github'] as const).filter((p) => clientOf(env, p));
  return json({ user, providers });
}

export async function logout(req: Request, env: Env): Promise<Response> {
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  await deleteSession(env.DB, readCookie(req, SESSION_COOKIE));
  return json({ ok: true }, 200, { 'set-cookie': cookie(SESSION_COOKIE, '', { maxAge: 0 }) });
}

export async function progress(req: Request, env: Env, deps: Deps): Promise<Response> {
  const user = await userForSession(env.DB, readCookie(req, SESSION_COOKIE), deps.now());
  if (!user) return json({ error: 'not signed in' }, 401);
  if (req.method === 'GET') return json(await readSave(env.DB, user.id));
  if (req.method !== 'PUT') return json({ error: 'method not allowed' }, 405);
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403);
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES) return json({ error: 'too large' }, 413);
  let body: { data?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return json({ error: 'data must be an object' }, 400);
  const now = deps.now();
  await writeSave(env.DB, user.id, JSON.stringify(body.data), now);
  return json({ updatedAt: now });
}

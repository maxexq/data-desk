// Sign in with Google or GitHub: the authorization-code flow with state and PKCE (S256).
import type { Deps, Env } from './types';
import { sha256 } from './http';

export type Provider = 'google' | 'github';
export const PROVIDERS: Provider[] = ['google', 'github'];
export const isProvider = (p: unknown): p is Provider => p === 'google' || p === 'github';

export interface Profile {
  providerId: string;
  name: string;
  avatarUrl: string | null;
}

export const callbackUrl = (origin: string, p: Provider) => `${origin}/api/auth/${p}/callback`;

export function clientOf(env: Env, p: Provider): { id: string; secret: string } | null {
  const id = p === 'google' ? env.GOOGLE_CLIENT_ID : env.GITHUB_CLIENT_ID;
  const secret = p === 'google' ? env.GOOGLE_CLIENT_SECRET : env.GITHUB_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

export async function authorizeUrl(p: Provider, clientId: string, redirectUri: string, state: string, verifier: string): Promise<string> {
  const challenge = await sha256(verifier);
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state, code_challenge: challenge, code_challenge_method: 'S256' });
  if (p === 'google') {
    // openid + profile only: a name and a picture, no e-mail address.
    q.set('response_type', 'code');
    q.set('scope', 'openid profile');
    q.set('prompt', 'select_account');
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  // No scope: GitHub then grants read access to public profile information only.
  q.set('allow_signup', 'true');
  return `https://github.com/login/oauth/authorize?${q}`;
}

export class OAuthError extends Error {}

/** Swap the code for an access token, then read the profile. Throws OAuthError on any failure. */
export async function fetchProfile(p: Provider, client: { id: string; secret: string }, code: string, redirectUri: string, verifier: string, deps: Deps): Promise<Profile> {
  const form = new URLSearchParams({ client_id: client.id, client_secret: client.secret, code, redirect_uri: redirectUri, code_verifier: verifier });
  if (p === 'google') form.set('grant_type', 'authorization_code');
  const tokenRes = await deps.fetch(p === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: form,
  });
  const token = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!tokenRes.ok || !token.access_token) throw new OAuthError(`token: ${token.error ?? tokenRes.status}`);

  const auth = { authorization: `Bearer ${token.access_token}`, accept: 'application/json', 'user-agent': 'data-desk' };
  if (p === 'google') {
    const r = await deps.fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: auth });
    const u = (await r.json().catch(() => ({}))) as { sub?: string; name?: string; picture?: string };
    if (!r.ok || !u.sub) throw new OAuthError(`profile: ${r.status}`);
    return { providerId: u.sub, name: u.name || 'Player', avatarUrl: u.picture ?? null };
  }
  const r = await deps.fetch('https://api.github.com/user', { headers: { ...auth, accept: 'application/vnd.github+json' } });
  const u = (await r.json().catch(() => ({}))) as { id?: number; login?: string; name?: string | null; avatar_url?: string };
  if (!r.ok || !u.id) throw new OAuthError(`profile: ${r.status}`);
  return { providerId: String(u.id), name: u.name || u.login || 'Player', avatarUrl: u.avatar_url ?? null };
}

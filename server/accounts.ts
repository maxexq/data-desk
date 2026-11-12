// Users, sessions and saved progress in D1.
import { randomToken, sha256 } from './http';
import type { Provider, Profile } from './oauth';
import type { D1Like } from './types';

export const SESSION_DAYS = 30;
export const MAX_SAVE_BYTES = 256 * 1024;

export interface User {
  id: string;
  provider: Provider;
  name: string;
  avatarUrl: string | null;
}

/** Find the account for this Google/GitHub identity, creating it the first time; keeps name and picture current. */
export async function upsertUser(db: D1Like, provider: Provider, profile: Profile, now: number): Promise<User> {
  const name = profile.name.slice(0, 100);
  const found = await db.prepare('SELECT id FROM users WHERE provider = ? AND provider_id = ?').bind(provider, profile.providerId).first<{ id: string }>();
  if (found) {
    await db.prepare('UPDATE users SET name = ?, avatar_url = ? WHERE id = ?').bind(name, profile.avatarUrl, found.id).run();
    return { id: found.id, provider, name, avatarUrl: profile.avatarUrl };
  }
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO users (id, provider, provider_id, name, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, provider, profile.providerId, name, profile.avatarUrl, now).run();
  return { id, provider, name, avatarUrl: profile.avatarUrl };
}

/** A new session; returns the cookie value. Only its hash is stored. */
export async function createSession(db: D1Like, userId: string, now: number): Promise<string> {
  const token = randomToken();
  await db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(token), userId, now, now + SESSION_DAYS * 864e5).run();
  return token;
}

export async function userForSession(db: D1Like, token: string | null, now: number): Promise<User | null> {
  if (!token) return null;
  const row = await db
    .prepare('SELECT u.id, u.provider, u.name, u.avatar_url FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await sha256(token), now)
    .first<{ id: string; provider: Provider; name: string; avatar_url: string | null }>();
  return row ? { id: row.id, provider: row.provider, name: row.name, avatarUrl: row.avatar_url } : null;
}

export async function deleteSession(db: D1Like, token: string | null) {
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export async function readSave(db: D1Like, userId: string) {
  const row = await db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').bind(userId).first<{ data: string; updated_at: number }>();
  return row ? { data: JSON.parse(row.data) as unknown, updatedAt: row.updated_at } : { data: null, updatedAt: null };
}

export async function writeSave(db: D1Like, userId: string, data: string, now: number) {
  await db.prepare('INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at').bind(userId, data, now).run();
}

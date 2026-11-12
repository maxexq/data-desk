-- Accounts for signing in with Google or GitHub, and each player's saved progress.
-- Apply with: npx wrangler d1 migrations apply data-desk --remote
-- Only what the game needs is kept: no e-mail address, no OAuth tokens.

CREATE TABLE users (
  id TEXT PRIMARY KEY,                -- random UUID, ours
  provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
  provider_id TEXT NOT NULL,          -- Google "sub" / GitHub numeric id
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,        -- unix ms
  UNIQUE (provider, provider_id)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,        -- SHA-256 of the cookie value; the value itself is never stored
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE saves (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  data TEXT NOT NULL,                 -- JSON written by the game (progress, notes, installed apps…)
  updated_at INTEGER NOT NULL
);

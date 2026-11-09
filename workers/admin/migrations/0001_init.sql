-- Wartabiye TV admin + analytics database (Cloudflare D1, free plan).
-- No visitor IP address, cookie or persistent identifier is ever stored. A visitor is a daily hash of
-- (daily random salt + IP + browser) and the salt is deleted after two days, so a hash cannot be traced back.

-- owner sign-in --------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL, updated INTEGER NOT NULL) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,            -- SHA-256 of the cookie value (the cookie itself is never stored)
  uid INTEGER NOT NULL,           -- GitHub user id
  login TEXT NOT NULL,
  name TEXT, avatar TEXT,
  stage TEXT NOT NULL,            -- 'mfa' (GitHub ok, code pending) | 'ok'
  created INTEGER NOT NULL, seen INTEGER NOT NULL, expires INTEGER NOT NULL,
  tok TEXT,                       -- GitHub user token, AES-GCM encrypted with SESSION_SECRET, never sent to a browser
  tok_exp INTEGER, rtok TEXT,     -- refresh token (encrypted)
  pend TEXT,                      -- pending authenticator secret during enrolment (encrypted)
  ua TEXT, country TEXT
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS mfa (
  uid INTEGER PRIMARY KEY,
  secret TEXT NOT NULL,           -- authenticator (TOTP) secret, encrypted
  last_step INTEGER NOT NULL DEFAULT 0,   -- last accepted 30-second step: a code can be used only once
  recovery TEXT NOT NULL,         -- JSON list of SHA-256 hashes of unused one-time recovery codes
  created INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS ratelimit (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS audit (
  ts INTEGER NOT NULL, event TEXT NOT NULL, login TEXT, ok INTEGER NOT NULL DEFAULT 1,
  ip TEXT,                        -- shortened address only (e.g. 41.78.x.x), for the owner's own security log
  country TEXT, ua TEXT, detail TEXT
);
CREATE INDEX IF NOT EXISTS audit_ts ON audit(ts);

-- visitor analytics ----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL) WITHOUT ROWID;

-- one row per visitor per day (raw, kept 8 days, then only the daily totals in day_stats remain)
CREATE TABLE IF NOT EXISTS visitors (
  day TEXT NOT NULL, vid TEXT NOT NULL,
  first_ts INTEGER NOT NULL, last_ts INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1, sessions INTEGER NOT NULL DEFAULT 1,
  device TEXT, country TEXT, lang TEXT,
  ret INTEGER,                    -- 1 returning, 0 new, NULL = visitor did not allow "remember this device"
  PRIMARY KEY (day, vid)
) WITHOUT ROWID;

-- page views per page per day
CREATE TABLE IF NOT EXISTS pages (
  day TEXT NOT NULL, path TEXT NOT NULL, cat TEXT NOT NULL DEFAULT '', views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
) WITHOUT ROWID;

-- page views per hour (Africa/Mogadishu time)
CREATE TABLE IF NOT EXISTS hours (day TEXT NOT NULL, hour INTEGER NOT NULL, views INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, hour)) WITHOUT ROWID;

-- visits by traffic source (counted when a visit enters the site)
CREATE TABLE IF NOT EXISTS sources (
  day TEXT NOT NULL, kind TEXT NOT NULL, host TEXT NOT NULL DEFAULT '', visits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, host)
) WITHOUT ROWID;

-- finished days: totals and breakdowns computed once from visitors (dim: total|device|country|lang)
CREATE TABLE IF NOT EXISTS day_stats (
  day TEXT NOT NULL, dim TEXT NOT NULL, key TEXT NOT NULL,
  visitors INTEGER NOT NULL DEFAULT 0, views INTEGER NOT NULL DEFAULT 0, sessions INTEGER NOT NULL DEFAULT 0,
  ret INTEGER NOT NULL DEFAULT 0, consented INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, dim, key)
) WITHOUT ROWID;

-- Public source only: never put account credentials or a private catalogue here.
CREATE TABLE IF NOT EXISTS oauth (
  hash TEXT PRIMARY KEY NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL, description TEXT NOT NULL, url TEXT NOT NULL, source TEXT NOT NULL,
  source_private INTEGER NOT NULL DEFAULT 1,
  visible INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'À qualifier' CHECK(status IN ('À qualifier','Idée','En préparation','En cours','En pause','Terminé')),
  due_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
  access_status TEXT NOT NULL DEFAULT 'unknown' CHECK(access_status IN ('unknown','protected'))
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY NOT NULL, token TEXT NOT NULL, csrf TEXT NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY NOT NULL, login TEXT NOT NULL, password TEXT NOT NULL,
  version TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
  key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL, expires INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
  status TEXT NOT NULL DEFAULT 'À faire' CHECK(status IN ('À faire','En cours','Terminé')),
  due_date TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);

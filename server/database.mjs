import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

// One transactional migration handles both a fresh installation and the legacy
// catalogue. Existing account hashes, sessions, IDs and revisions are untouched.
const SCHEMA_VERSION = 4;
export function database(filename) {
  const sql = new DatabaseSync(filename);
  try {
    sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
    const version = sql.prepare('PRAGMA user_version').get().user_version;
    if (version > SCHEMA_VERSION) throw new Error('Database schema is newer than this application.');
    if (version < 1) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        sql.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
        const columns = new Set(sql.prepare('PRAGMA table_info(projects)').all().map(column => column.name));
        const additions = {
          status: "TEXT NOT NULL DEFAULT 'À qualifier' CHECK(status IN ('À qualifier','Idée','En préparation','En cours','En pause','Terminé'))",
          due_date: 'TEXT',
          notes: "TEXT NOT NULL DEFAULT ''",
          archived: 'INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))',
          access_status: "TEXT NOT NULL DEFAULT 'unknown' CHECK(access_status IN ('unknown','protected'))",
        };
        for (const [name, definition] of Object.entries(additions)) {
          if (!columns.has(name)) sql.exec(`ALTER TABLE projects ADD COLUMN ${name} ${definition}`);
        }
        sql.exec('PRAGMA user_version=1; COMMIT;');
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
    if (version < 2) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        sql.exec(`
          CREATE TABLE IF NOT EXISTS project_worksheets (
            project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
            title TEXT NOT NULL, workbook BLOB NOT NULL
          );
          CREATE TABLE IF NOT EXISTS worksheet_rows (
            project_id TEXT NOT NULL REFERENCES project_worksheets(project_id) ON DELETE RESTRICT,
            id INTEGER NOT NULL CHECK(id BETWEEN 1 AND 1048576),
            ref TEXT NOT NULL, subject TEXT NOT NULL, description TEXT NOT NULL,
            code TEXT NOT NULL, articles TEXT NOT NULL, family TEXT NOT NULL,
            pages TEXT NOT NULL, support TEXT NOT NULL,
            priority TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '',
            comment TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
            PRIMARY KEY(project_id,id)
          );
          PRAGMA user_version=2;
          COMMIT;
        `);
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
    if (version < 3) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        if (!sql.prepare('PRAGMA table_info(worksheet_rows)').all().some(column => column.name === 'decision')) {
          sql.exec("ALTER TABLE worksheet_rows ADD COLUMN decision TEXT NOT NULL DEFAULT '' CHECK(length(decision)<=400);");
        }
        sql.exec('PRAGMA user_version=3; COMMIT;');
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
    if (version < 4) {
      sql.exec('BEGIN IMMEDIATE');
      try {
        sql.exec(`
          CREATE TABLE IF NOT EXISTS project_questionnaire (
            project_id TEXT PRIMARY KEY NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
            answers TEXT NOT NULL, comment TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK(revision>=1), updated_at INTEGER NOT NULL
          );
          PRAGMA user_version=4;
          COMMIT;
        `);
      } catch (error) { sql.exec('ROLLBACK'); throw error; }
    }
    if (sql.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Database foreign key integrity check failed.');
  } catch (error) { sql.close(); throw error; }
  function prepare(query) {
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { return sql.prepare(query).get(...args) || null; },
      async all() { return {results: sql.prepare(query).all(...args)}; },
      runSync() { return {meta: {changes: sql.prepare(query).run(...args).changes}}; },
      async run() { return this.runSync(); },
    };
  }
  return {sql, prepare, async batch(statements) {
    sql.exec('BEGIN IMMEDIATE');
    try { const results = statements.map(statement => statement.runSync()); sql.exec('COMMIT'); return results; }
    catch (error) { sql.exec('ROLLBACK'); throw error; }
  }};
}

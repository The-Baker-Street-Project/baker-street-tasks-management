import type BetterSqlite3 from "better-sqlite3";

/**
 * Set up FTS5 virtual table and sync triggers for full-text search on tasks.
 * Safe to call multiple times (uses IF NOT EXISTS / IF EXISTS checks).
 *
 * Note: The `.exec()` calls here are better-sqlite3 database methods, not
 * child_process.exec. They run SQL statements directly on the SQLite engine.
 */
export function setupFts(sqlite: BetterSqlite3.Database): void {
  // Create FTS5 virtual table
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
      id UNINDEXED,
      title,
      notes
    );
  `);

  // Sync triggers — drop and recreate to ensure they are current
  sqlite.exec(`
    DROP TRIGGER IF EXISTS tasks_fts_insert;
    CREATE TRIGGER tasks_fts_insert AFTER INSERT ON tasks BEGIN
      INSERT INTO tasks_fts(id, title, notes)
        VALUES (NEW.id, NEW.title, COALESCE(NEW.notes, ''));
    END;
  `);

  sqlite.exec(`
    DROP TRIGGER IF EXISTS tasks_fts_update;
    CREATE TRIGGER tasks_fts_update AFTER UPDATE OF title, notes ON tasks BEGIN
      UPDATE tasks_fts SET title = NEW.title, notes = COALESCE(NEW.notes, '')
        WHERE id = NEW.id;
    END;
  `);

  sqlite.exec(`
    DROP TRIGGER IF EXISTS tasks_fts_delete;
    CREATE TRIGGER tasks_fts_delete AFTER DELETE ON tasks BEGIN
      DELETE FROM tasks_fts WHERE id = OLD.id;
    END;
  `);

  // Back-fill any existing tasks that are not yet in the FTS table
  sqlite.exec(`
    INSERT OR IGNORE INTO tasks_fts(id, title, notes)
      SELECT id, title, COALESCE(notes, '') FROM tasks
      WHERE id NOT IN (SELECT id FROM tasks_fts);
  `);
}

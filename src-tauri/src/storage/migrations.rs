use rusqlite::Connection;
use crate::error::AppError;

pub fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS local_documents (
            id TEXT PRIMARY KEY NOT NULL,
            user_id TEXT NOT NULL DEFAULT 'local_guest',
            parent_id TEXT,
            title TEXT NOT NULL,
            content TEXT,
            doc_type TEXT NOT NULL CHECK(doc_type IN ('text', 'canvas', 'pdf', 'epub')),
            status TEXT NOT NULL CHECK(status IN ('active', 'deleted', 'archived')) DEFAULT 'active',
            is_expanded INTEGER NOT NULL DEFAULT 0,
            is_favorite INTEGER NOT NULL DEFAULT 0,
            tags TEXT,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY(parent_id) REFERENCES local_documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_local_docs_parent ON local_documents(parent_id);
        CREATE INDEX IF NOT EXISTS idx_local_docs_status ON local_documents(status);

        CREATE TABLE IF NOT EXISTS document_crdt_deltas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id TEXT NOT NULL,
            delta BLOB NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY(document_id) REFERENCES local_documents(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_crdt_deltas_doc ON document_crdt_deltas(document_id);

        CREATE TABLE IF NOT EXISTS document_snapshots (
            document_id TEXT PRIMARY KEY NOT NULL,
            snapshot BLOB NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY(document_id) REFERENCES local_documents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS sync_outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            payload TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS local_media (
            id TEXT PRIMARY KEY NOT NULL,
            document_id TEXT NOT NULL,
            local_path TEXT NOT NULL,
            remote_url TEXT,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            sync_status TEXT NOT NULL CHECK(sync_status IN ('pending', 'uploaded', 'error')),
            created_at INTEGER NOT NULL
        );
        "
    )?;

    Ok(())
}

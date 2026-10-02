use std::path::Path;
use rusqlite::{params, Connection};
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::domain::document::{
    CreateDocumentInput, DocumentStatus, DocumentType, LocalDocument, UpdateDocumentInput,
};
use crate::error::AppError;
use crate::storage::migrations::run_migrations;

pub enum DbMessage {
    GetDocuments {
        responder: oneshot::Sender<Result<Vec<LocalDocument>, AppError>>,
    },
    GetDocument {
        id: String,
        responder: oneshot::Sender<Result<LocalDocument, AppError>>,
    },
    CreateDocument {
        input: CreateDocumentInput,
        responder: oneshot::Sender<Result<LocalDocument, AppError>>,
    },
    UpdateDocument {
        input: UpdateDocumentInput,
        responder: oneshot::Sender<Result<LocalDocument, AppError>>,
    },
    DeleteDocument {
        id: String,
        responder: oneshot::Sender<Result<(), AppError>>,
    },
    SaveCrdtDelta {
        document_id: String,
        delta: Vec<u8>,
        responder: oneshot::Sender<Result<(), AppError>>,
    },
    GetCrdtDeltas {
        document_id: String,
        responder: oneshot::Sender<Result<Vec<Vec<u8>>, AppError>>,
    },
}

#[derive(Clone)]
pub struct DatabaseHandle {
    sender: mpsc::Sender<DbMessage>,
}

impl DatabaseHandle {
    pub fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, AppError> {
        let conn = Connection::open(db_path)?;
        run_migrations(&conn)?;

        let (sender, mut receiver) = mpsc::channel::<DbMessage>(128);

        // Dedicar un hilo del sistema operativo a la conexión SQLite ("comparte memoria comunicando")
        std::thread::Builder::new()
            .name("sqlite-worker".to_string())
            .spawn(move || {
                let mut conn = conn;
                while let Some(msg) = receiver.blocking_recv() {
                    handle_db_message(&mut conn, msg);
                }
            })?;

        Ok(Self { sender })
    }

    pub async fn get_documents(&self) -> Result<Vec<LocalDocument>, AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(DbMessage::GetDocuments { responder })
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }

    pub async fn get_document(&self, id: String) -> Result<LocalDocument, AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(DbMessage::GetDocument { id, responder })
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }

    pub async fn create_document(
        &self,
        input: CreateDocumentInput,
    ) -> Result<LocalDocument, AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(DbMessage::CreateDocument { input, responder })
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }

    pub async fn update_document(
        &self,
        input: UpdateDocumentInput,
    ) -> Result<LocalDocument, AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(DbMessage::UpdateDocument { input, responder })
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }

    pub async fn delete_document(&self, id: String) -> Result<(), AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(DbMessage::DeleteDocument { id, responder })
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }

    pub async fn save_crdt_delta(
        &self,
        document_id: String,
        delta: Vec<u8>,
    ) -> Result<(), AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(DbMessage::SaveCrdtDelta {
                document_id,
                delta,
                responder,
            })
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }

    pub async fn get_crdt_deltas(
        &self,
        document_id: String,
    ) -> Result<Vec<Vec<u8>>, AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(DbMessage::GetCrdtDeltas {
                document_id,
                responder,
            })
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }
}

fn handle_db_message(conn: &mut Connection, msg: DbMessage) {
    match msg {
        DbMessage::GetDocuments { responder } => {
            let res = query_documents(conn);
            let _ = responder.send(res);
        }
        DbMessage::GetDocument { id, responder } => {
            let res = query_document_by_id(conn, &id);
            let _ = responder.send(res);
        }
        DbMessage::CreateDocument { input, responder } => {
            let res = insert_document(conn, input);
            let _ = responder.send(res);
        }
        DbMessage::UpdateDocument { input, responder } => {
            let res = modify_document(conn, input);
            let _ = responder.send(res);
        }
        DbMessage::DeleteDocument { id, responder } => {
            let res = remove_document(conn, &id);
            let _ = responder.send(res);
        }
        DbMessage::SaveCrdtDelta {
            document_id,
            delta,
            responder,
        } => {
            let res = insert_crdt_delta(conn, &document_id, &delta);
            let _ = responder.send(res);
        }
        DbMessage::GetCrdtDeltas {
            document_id,
            responder,
        } => {
            let res = query_crdt_deltas(conn, &document_id);
            let _ = responder.send(res);
        }
    }
}

fn query_documents(conn: &Connection) -> Result<Vec<LocalDocument>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, parent_id, title, content, doc_type, status,
                is_expanded, is_favorite, tags, display_order, created_at, updated_at
         FROM local_documents
         WHERE status != 'deleted'
         ORDER BY display_order ASC, created_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let doc_type_str: String = row.get(5)?;
        let status_str: String = row.get(6)?;

        let doc_type = DocumentType::from_str_opt(&doc_type_str)
            .unwrap_or(DocumentType::Text);
        let status = DocumentStatus::from_str_opt(&status_str)
            .unwrap_or(DocumentStatus::Active);

        let is_expanded_int: i32 = row.get(7)?;
        let is_favorite_int: i32 = row.get(8)?;

        Ok(LocalDocument {
            id: row.get(0)?,
            user_id: row.get(1)?,
            parent_id: row.get(2)?,
            title: row.get(3)?,
            content: row.get(4)?,
            doc_type,
            status,
            is_expanded: is_expanded_int != 0,
            is_favorite: is_favorite_int != 0,
            tags: row.get(9)?,
            order: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    })?;

    let documents = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(documents)
}

fn query_document_by_id(conn: &Connection, id: &str) -> Result<LocalDocument, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, parent_id, title, content, doc_type, status,
                is_expanded, is_favorite, tags, display_order, created_at, updated_at
         FROM local_documents
         WHERE id = ?1",
    )?;

    let doc = stmt.query_row(params![id], |row| {
        let doc_type_str: String = row.get(5)?;
        let status_str: String = row.get(6)?;

        let doc_type = DocumentType::from_str_opt(&doc_type_str)
            .unwrap_or(DocumentType::Text);
        let status = DocumentStatus::from_str_opt(&status_str)
            .unwrap_or(DocumentStatus::Active);

        let is_expanded_int: i32 = row.get(7)?;
        let is_favorite_int: i32 = row.get(8)?;

        Ok(LocalDocument {
            id: row.get(0)?,
            user_id: row.get(1)?,
            parent_id: row.get(2)?,
            title: row.get(3)?,
            content: row.get(4)?,
            doc_type,
            status,
            is_expanded: is_expanded_int != 0,
            is_favorite: is_favorite_int != 0,
            tags: row.get(9)?,
            order: row.get(10)?,
            created_at: row.get(11)?,
            updated_at: row.get(12)?,
        })
    }).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => AppError::DocumentNotFound(id.to_string()),
        other => AppError::Database(other),
    })?;

    Ok(doc)
}

fn insert_document(
    conn: &mut Connection,
    input: CreateDocumentInput,
) -> Result<LocalDocument, AppError> {
    let id = input.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = chrono::Utc::now().timestamp_millis();

    conn.execute(
        "INSERT INTO local_documents (
            id, user_id, parent_id, title, content, doc_type, status,
            is_expanded, is_favorite, tags, display_order, created_at, updated_at
         ) VALUES (?1, 'local_guest', ?2, ?3, ?4, ?5, 'active', 0, 0, NULL, 0, ?6, ?7)",
        params![
            &id,
            input.parent_id,
            &input.title,
            input.content,
            input.doc_type.as_str(),
            now,
            now
        ],
    )?;

    query_document_by_id(conn, &id)
}

fn modify_document(
    conn: &mut Connection,
    input: UpdateDocumentInput,
) -> Result<LocalDocument, AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    let current = query_document_by_id(conn, &input.id)?;

    let title = input.title.unwrap_or(current.title);
    let content = input.content.or(current.content);
    let parent_id = input.parent_id.or(current.parent_id);
    let is_favorite = input.is_favorite.unwrap_or(current.is_favorite);
    let is_expanded = input.is_expanded.unwrap_or(current.is_expanded);
    let status = input.status.unwrap_or(current.status);

    conn.execute(
        "UPDATE local_documents SET
            title = ?1,
            content = ?2,
            parent_id = ?3,
            is_favorite = ?4,
            is_expanded = ?5,
            status = ?6,
            updated_at = ?7
         WHERE id = ?8",
        params![
            &title,
            content,
            parent_id,
            i32::from(is_favorite),
            i32::from(is_expanded),
            status.as_str(),
            now,
            &input.id
        ],
    )?;

    query_document_by_id(conn, &input.id)
}

fn remove_document(conn: &mut Connection, id: &str) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "UPDATE local_documents SET status = 'deleted', updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )?;
    Ok(())
}

fn insert_crdt_delta(
    conn: &mut Connection,
    document_id: &str,
    delta: &[u8],
) -> Result<(), AppError> {
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT INTO document_crdt_deltas (document_id, delta, created_at) VALUES (?1, ?2, ?3)",
        params![document_id, delta, now],
    )?;
    Ok(())
}

fn query_crdt_deltas(
    conn: &Connection,
    document_id: &str,
) -> Result<Vec<Vec<u8>>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT delta FROM document_crdt_deltas WHERE document_id = ?1 ORDER BY id ASC",
    )?;

    let rows = stmt.query_map(params![document_id], |row| row.get(0))?;
    let deltas = rows.collect::<Result<Vec<Vec<u8>>, _>>()?;
    Ok(deltas)
}

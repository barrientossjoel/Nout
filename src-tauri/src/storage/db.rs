use std::path::Path;
use rusqlite::{params, Connection};
use tokio::sync::{mpsc, oneshot};
use uuid::Uuid;

use crate::domain::document::{
    CreateDocumentInput, DocumentStatus, DocumentType, LocalDocument, UpdateDocumentInput,
    UpsertDocumentInput,
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
    UpsertDocuments {
        documents: Vec<UpsertDocumentInput>,
        responder: oneshot::Sender<Result<Vec<LocalDocument>, AppError>>,
    },
}

#[derive(Clone)]
pub struct DatabaseHandle {
    sender: mpsc::Sender<DbMessage>,
}

impl DatabaseHandle {
    /// Creates a new `DatabaseHandle` by opening the SQLite database at `db_path`,
    /// running pending migrations, and spawning the dedicated worker thread.
    ///
    /// # Errors
    ///
    /// Returns [`AppError::Database`] or [`AppError::Io`] if opening the database,
    /// applying migrations, or spawning the worker thread fails.
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

    async fn send_request<T>(&self, make_msg: impl FnOnce(oneshot::Sender<Result<T, AppError>>) -> DbMessage) -> Result<T, AppError> {
        let (responder, receiver) = oneshot::channel();
        self.sender
            .send(make_msg(responder))
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?;
        receiver
            .await
            .map_err(|e| AppError::ChannelCommunication(e.to_string()))?
    }

    /// Fetches all non-deleted local documents ordered by display order and creation date.
    ///
    /// # Errors
    ///
    /// Returns [`AppError`] if querying the database or channel communication fails.
    pub async fn get_documents(&self) -> Result<Vec<LocalDocument>, AppError> {
        self.send_request(|responder| DbMessage::GetDocuments { responder }).await
    }

    /// Fetches a single local document by its unique ID.
    ///
    /// # Errors
    ///
    /// Returns [`AppError::DocumentNotFound`] if not found, or [`AppError`] on query failure.
    pub async fn get_document(&self, id: &str) -> Result<LocalDocument, AppError> {
        self.send_request(|responder| DbMessage::GetDocument { id: id.to_string(), responder }).await
    }

    /// Inserts a new document into the database.
    ///
    /// # Errors
    ///
    /// Returns [`AppError`] if insertion or database execution fails.
    pub async fn create_document(
        &self,
        input: CreateDocumentInput,
    ) -> Result<LocalDocument, AppError> {
        self.send_request(|responder| DbMessage::CreateDocument { input, responder }).await
    }

    /// Updates existing document fields in local storage.
    ///
    /// # Errors
    ///
    /// Returns [`AppError`] if the document is not found or update fails.
    pub async fn update_document(
        &self,
        input: UpdateDocumentInput,
    ) -> Result<LocalDocument, AppError> {
        self.send_request(|responder| DbMessage::UpdateDocument { input, responder }).await
    }

    /// Marks a document as deleted.
    ///
    /// # Errors
    ///
    /// Returns [`AppError`] if the update fails.
    pub async fn delete_document(&self, id: &str) -> Result<(), AppError> {
        self.send_request(|responder| DbMessage::DeleteDocument { id: id.to_string(), responder }).await
    }

    /// Saves a binary CRDT update delta for a document.
    ///
    /// # Errors
    ///
    /// Returns [`AppError`] if delta insertion fails.
    pub async fn save_crdt_delta(
        &self,
        document_id: &str,
        delta: Vec<u8>,
    ) -> Result<(), AppError> {
        self.send_request(|responder| DbMessage::SaveCrdtDelta {
            document_id: document_id.to_string(),
            delta,
            responder,
        }).await
    }

    /// Retrieves all CRDT update deltas for a document in ascending sequence.
    ///
    /// # Errors
    ///
    /// Returns [`AppError`] if querying deltas fails.
    pub async fn get_crdt_deltas(
        &self,
        document_id: &str,
    ) -> Result<Vec<Vec<u8>>, AppError> {
        self.send_request(|responder| DbMessage::GetCrdtDeltas {
            document_id: document_id.to_string(),
            responder,
        }).await
    }

    /// Atomically upserts an array of documents into local storage.
    ///
    /// # Errors
    ///
    /// Returns [`AppError`] if batch execution fails.
    pub async fn upsert_documents(
        &self,
        documents: Vec<UpsertDocumentInput>,
    ) -> Result<Vec<LocalDocument>, AppError> {
        self.send_request(|responder| DbMessage::UpsertDocuments { documents, responder }).await
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
        DbMessage::UpsertDocuments {
            documents,
            responder,
        } => {
            let res = batch_upsert_documents(conn, documents);
            let _ = responder.send(res);
        }
    }
}

fn map_doc_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LocalDocument> {
    let doc_type_str: String = row.get(5)?;
    let status_str: String = row.get(6)?;

    let doc_type = DocumentType::from_str_opt(&doc_type_str).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            5,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Unknown doc_type: {doc_type_str}"),
            )),
        )
    })?;

    let status = DocumentStatus::from_str_opt(&status_str).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            6,
            rusqlite::types::Type::Text,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("Unknown status: {status_str}"),
            )),
        )
    })?;

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
}

fn query_documents(conn: &Connection) -> Result<Vec<LocalDocument>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, parent_id, title, content, doc_type, status,
                is_expanded, is_favorite, tags, display_order, created_at, updated_at
         FROM local_documents
         ORDER BY display_order ASC, created_at DESC",
    )?;

    let documents = stmt.query_map([], map_doc_row)?.collect::<Result<Vec<_>, _>>()?;
    Ok(documents)
}

fn query_document_by_id(conn: &Connection, id: &str) -> Result<LocalDocument, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, user_id, parent_id, title, content, doc_type, status,
                is_expanded, is_favorite, tags, display_order, created_at, updated_at
         FROM local_documents
         WHERE id = ?1",
    )?;

    let doc = stmt.query_row(params![id], map_doc_row).map_err(|e| match e {
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

fn sort_documents_topologically(mut docs: Vec<UpsertDocumentInput>) -> Vec<UpsertDocumentInput> {
    let batch_ids: std::collections::HashSet<String> = docs.iter().map(|d| d.id.clone()).collect();
    let mut resolved_ids = std::collections::HashSet::new();
    let mut sorted = Vec::with_capacity(docs.len());

    while !docs.is_empty() {
        let (ready, pending): (Vec<_>, Vec<_>) = docs.into_iter().partition(|doc| {
            match &doc.parent_id {
                None => true,
                Some(parent_id) => !batch_ids.contains(parent_id) || resolved_ids.contains(parent_id),
            }
        });

        if ready.is_empty() {
            // Resolve any circular references or deadlocks by appending remaining docs
            sorted.extend(pending);
            break;
        }

        for doc in &ready {
            resolved_ids.insert(doc.id.clone());
        }
        sorted.extend(ready);
        docs = pending;
    }

    sorted
}

fn batch_upsert_documents(
    conn: &mut Connection,
    documents: Vec<UpsertDocumentInput>,
) -> Result<Vec<LocalDocument>, AppError> {
    let sorted_documents = sort_documents_topologically(documents);
    let tx = conn.transaction()?;
    let now = chrono::Utc::now().timestamp_millis();

    for input in sorted_documents {
        let user_id = input.user_id.unwrap_or_else(|| "local_guest".to_string());
        let doc_type = input.doc_type.map_or("text", DocumentType::as_str);
        let status = input.status.map_or("active", DocumentStatus::as_str);
        let is_expanded = i32::from(input.is_expanded.unwrap_or(false));
        let is_favorite = i32::from(input.is_favorite.unwrap_or(false));
        let order = input.order.unwrap_or(0);
        let created_at = input.created_at.unwrap_or(now);
        let updated_at = input.updated_at.unwrap_or(now);

        tx.execute(
            "INSERT INTO local_documents (
                id, user_id, parent_id, title, content, doc_type, status,
                is_expanded, is_favorite, tags, display_order, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET
                user_id = excluded.user_id,
                title = excluded.title,
                content = COALESCE(excluded.content, local_documents.content),
                parent_id = excluded.parent_id,
                doc_type = excluded.doc_type,
                status = excluded.status,
                is_expanded = excluded.is_expanded,
                is_favorite = excluded.is_favorite,
                tags = excluded.tags,
                display_order = excluded.display_order,
                updated_at = excluded.updated_at",
            params![
                input.id,
                user_id,
                input.parent_id,
                input.title,
                input.content,
                doc_type,
                status,
                is_expanded,
                is_favorite,
                input.tags,
                order,
                created_at,
                updated_at,
            ],
        )?;
    }

    tx.commit()?;
    query_documents(conn)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_upsert_out_of_order_parent() {
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();

        let doc_child = UpsertDocumentInput {
            id: "child-1".to_string(),
            user_id: Some("user-1".to_string()),
            parent_id: Some("parent-1".to_string()),
            title: "Child Doc".to_string(),
            content: Some("Child content".to_string()),
            doc_type: None,
            status: None,
            is_expanded: None,
            is_favorite: None,
            tags: None,
            order: None,
            created_at: None,
            updated_at: None,
        };

        let doc_parent = UpsertDocumentInput {
            id: "parent-1".to_string(),
            user_id: Some("user-1".to_string()),
            parent_id: None,
            title: "Parent Doc".to_string(),
            content: Some("Parent content".to_string()),
            doc_type: None,
            status: None,
            is_expanded: None,
            is_favorite: None,
            tags: None,
            order: None,
            created_at: None,
            updated_at: None,
        };

        let res = batch_upsert_documents(&mut conn, vec![doc_child, doc_parent]);
        assert!(res.is_ok(), "Batch upsert failed: {:?}", res.err());
    }

    #[test]
    fn test_deserialize_and_upsert_json() {
        let json_data = r#"[
            {
                "id": "doc-1",
                "userId": "user-1",
                "parentId": null,
                "title": "Title 1",
                "content": "Content 1",
                "docType": "text",
                "status": "active",
                "isExpanded": false,
                "isFavorite": false,
                "tags": null,
                "order": 0,
                "createdAt": 1771123229000,
                "updatedAt": 1771123229000
            },
            {
                "id": "doc-child",
                "userId": "user-1",
                "parentId": "doc-1",
                "title": "Child 1",
                "content": null,
                "docType": "canvas",
                "status": "active",
                "isExpanded": true,
                "isFavorite": true,
                "tags": "[\"tag1\"]",
                "order": 1,
                "createdAt": 1771123229000,
                "updatedAt": 1771123229000
            }
        ]"#;

        let docs: Vec<UpsertDocumentInput> = serde_json::from_str(json_data).unwrap();
        let mut conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        let res = batch_upsert_documents(&mut conn, docs);
        assert!(res.is_ok(), "Upsert failed: {:?}", res.err());
        let returned = res.unwrap();
        assert_eq!(returned.len(), 2);
    }
}



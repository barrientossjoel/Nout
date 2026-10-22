use tauri::State;

use crate::domain::document::{
    CreateDocumentInput, LocalDocument, UpdateDocumentInput, UpsertDocumentInput,
};
use crate::error::AppError;
use crate::AppState;

/// Retrieves all local documents from SQLite database.
///
/// # Errors
///
/// Returns [`AppError`] if querying the database fails.
#[tauri::command]
pub async fn get_local_documents(
    state: State<'_, AppState>,
) -> Result<Vec<LocalDocument>, AppError> {
    state.db.get_documents().await
}

/// Retrieves a single local document by its unique ID.
///
/// # Errors
///
/// Returns [`AppError::DocumentNotFound`] if the document does not exist, or [`AppError`] on query failure.
#[tauri::command]
pub async fn get_local_document(
    state: State<'_, AppState>,
    id: String,
) -> Result<LocalDocument, AppError> {
    state.db.get_document(&id).await
}

/// Creates a new document in the local SQLite storage.
///
/// # Errors
///
/// Returns [`AppError`] if inserting the document fails.
#[tauri::command]
pub async fn create_local_document(
    state: State<'_, AppState>,
    input: CreateDocumentInput,
) -> Result<LocalDocument, AppError> {
    state.db.create_document(input).await
}

/// Updates an existing document in the local SQLite storage.
///
/// # Errors
///
/// Returns [`AppError::DocumentNotFound`] or database errors.
#[tauri::command]
pub async fn update_local_document(
    state: State<'_, AppState>,
    input: UpdateDocumentInput,
) -> Result<LocalDocument, AppError> {
    state.db.update_document(input).await
}

/// Atomically upserts a batch of documents from cloud synchronization into local storage.
///
/// # Errors
///
/// Returns [`AppError`] if the transactional batch upsert fails.
#[tauri::command]
pub async fn upsert_local_documents(
    state: State<'_, AppState>,
    documents: Vec<UpsertDocumentInput>,
) -> Result<Vec<LocalDocument>, AppError> {
    state.db.upsert_documents(documents).await
}

/// Marks a local document as deleted.
///
/// # Errors
///
/// Returns [`AppError`] if updating the document status fails.
#[tauri::command]
pub async fn delete_local_document(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    state.db.delete_document(&id).await
}

/// Persists a binary CRDT update delta for local offline conflict resolution.
///
/// # Errors
///
/// Returns [`AppError`] if saving the delta fails.
#[tauri::command]
pub async fn save_crdt_delta(
    state: State<'_, AppState>,
    document_id: String,
    delta: Vec<u8>,
) -> Result<(), AppError> {
    state.db.save_crdt_delta(&document_id, delta).await
}

/// Retrieves all accumulated CRDT deltas for a specific document.
///
/// # Errors
///
/// Returns [`AppError`] if querying deltas fails.
#[tauri::command]
pub async fn get_crdt_deltas(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<Vec<Vec<u8>>, AppError> {
    state.db.get_crdt_deltas(&document_id).await
}

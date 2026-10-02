use tauri::State;

use crate::domain::document::{
    CreateDocumentInput, LocalDocument, UpdateDocumentInput,
};
use crate::error::AppError;
use crate::AppState;

#[tauri::command]
pub async fn get_local_documents(
    state: State<'_, AppState>,
) -> Result<Vec<LocalDocument>, AppError> {
    state.db.get_documents().await
}

#[tauri::command]
pub async fn get_local_document(
    state: State<'_, AppState>,
    id: String,
) -> Result<LocalDocument, AppError> {
    state.db.get_document(id).await
}

#[tauri::command]
pub async fn create_local_document(
    state: State<'_, AppState>,
    input: CreateDocumentInput,
) -> Result<LocalDocument, AppError> {
    state.db.create_document(input).await
}

#[tauri::command]
pub async fn update_local_document(
    state: State<'_, AppState>,
    input: UpdateDocumentInput,
) -> Result<LocalDocument, AppError> {
    state.db.update_document(input).await
}

#[tauri::command]
pub async fn delete_local_document(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    state.db.delete_document(id).await
}

#[tauri::command]
pub async fn save_crdt_delta(
    state: State<'_, AppState>,
    document_id: String,
    delta: Vec<u8>,
) -> Result<(), AppError> {
    state.db.save_crdt_delta(document_id, delta).await
}

#[tauri::command]
pub async fn get_crdt_deltas(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<Vec<Vec<u8>>, AppError> {
    state.db.get_crdt_deltas(document_id).await
}

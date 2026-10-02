use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrdtDelta {
    pub id: Option<i64>,
    pub document_id: String,
    pub delta: Vec<u8>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSnapshot {
    pub document_id: String,
    pub snapshot: Vec<u8>,
    pub updated_at: i64,
}

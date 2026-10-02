use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentType {
    Text,
    Canvas,
    Pdf,
    Epub,
}

impl DocumentType {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Canvas => "canvas",
            Self::Pdf => "pdf",
            Self::Epub => "epub",
        }
    }

    #[must_use]
    pub fn from_str_opt(s: &str) -> Option<Self> {
        match s {
            "text" => Some(Self::Text),
            "canvas" => Some(Self::Canvas),
            "pdf" => Some(Self::Pdf),
            "epub" => Some(Self::Epub),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentStatus {
    Active,
    Deleted,
    Archived,
}

impl DocumentStatus {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Deleted => "deleted",
            Self::Archived => "archived",
        }
    }

    #[must_use]
    pub fn from_str_opt(s: &str) -> Option<Self> {
        match s {
            "active" => Some(Self::Active),
            "deleted" => Some(Self::Deleted),
            "archived" => Some(Self::Archived),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDocument {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub content: Option<String>,
    pub parent_id: Option<String>,
    pub doc_type: DocumentType,
    pub status: DocumentStatus,
    pub is_expanded: bool,
    pub is_favorite: bool,
    pub tags: Option<String>,
    pub order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentInput {
    pub id: Option<String>,
    pub parent_id: Option<String>,
    pub title: String,
    pub doc_type: DocumentType,
    pub content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocumentInput {
    pub id: String,
    pub title: Option<String>,
    pub content: Option<String>,
    pub parent_id: Option<String>,
    pub is_favorite: Option<bool>,
    pub is_expanded: Option<bool>,
    pub status: Option<DocumentStatus>,
}

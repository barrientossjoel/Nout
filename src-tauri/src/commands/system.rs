use serde::Serialize;
use tauri::Manager;
use crate::error::AppError;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformInfo {
    pub os: String,
    pub is_native: bool,
    pub version: String,
}

#[tauri::command]
#[must_use]
pub fn get_platform_info() -> PlatformInfo {
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "android") {
        "android"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "unknown"
    };

    PlatformInfo {
        os: os.to_string(),
        is_native: true,
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
#[must_use]
pub fn pick_vault_folder() -> Option<String> {
    rfd::FileDialog::new()
        .set_title("Seleccionar carpeta de la bóveda Nout")
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn get_default_vault_folder(app: tauri::AppHandle) -> Result<String, AppError> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let vault = docs.join("Nout Vault");
    Ok(vault.to_string_lossy().to_string())
}

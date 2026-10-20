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
    #[cfg(not(target_os = "android"))]
    {
        rfd::FileDialog::new()
            .set_title("Seleccionar carpeta de la bóveda Nout")
            .pick_folder()
            .map(|path| path.to_string_lossy().to_string())
    }
    #[cfg(target_os = "android")]
    {
        None
    }
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

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn trigger_app_update(app: tauri::AppHandle, apk_url: String) -> Result<(), AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = app;
        android_update(&apk_url)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, apk_url);
        Ok(())
    }
}

#[cfg(target_os = "android")]
fn android_update(apk_url: &str) -> Result<(), AppError> {
    let jvm = crate::get_jvm().ok_or_else(|| {
        AppError::Internal("JVM instance not initialized".to_string())
    })?;

    let mut env = jvm.attach_current_thread().map_err(|e| {
        AppError::Internal(format!("Failed to attach JNI thread: {e}"))
    })?;

    let class = env.find_class("app/nout/desktop/MainActivity").map_err(|e| {
        AppError::Internal(format!("Failed to locate MainActivity: {e}"))
    })?;

    let j_url = env.new_string(apk_url).map_err(|e| {
        AppError::Internal(format!("Failed to create Java string: {e}"))
    })?;

    env.call_static_method(
        class,
        "updateApp",
        "(Ljava/lang/String;)V",
        &[jni::objects::JValue::Object(&j_url)],
    ).map_err(|e| {
        AppError::Internal(format!("Failed to execute updateApp: {e}"))
    })?;

    Ok(())
}

#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = app;
        android_open_url(&url)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, url);
        Ok(())
    }
}

#[cfg(target_os = "android")]
fn android_open_url(url: &str) -> Result<(), AppError> {
    let jvm = crate::get_jvm().ok_or_else(|| {
        AppError::Internal("JVM instance not initialized".to_string())
    })?;

    let mut env = jvm.attach_current_thread().map_err(|e| {
        AppError::Internal(format!("Failed to attach JNI thread: {e}"))
    })?;

    let class = env.find_class("app/nout/desktop/MainActivity").map_err(|e| {
        AppError::Internal(format!("Failed to locate MainActivity: {e}"))
    })?;

    let j_url = env.new_string(url).map_err(|e| {
        AppError::Internal(format!("Failed to create Java string: {e}"))
    })?;

    env.call_static_method(
        class,
        "openUrl",
        "(Ljava/lang/String;)V",
        &[jni::objects::JValue::Object(&j_url)],
    ).map_err(|e| {
        AppError::Internal(format!("Failed to execute openUrl: {e}"))
    })?;

    Ok(())
}


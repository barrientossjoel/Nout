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

/// Retrieves the default vault folder for the application.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if the system documents directory cannot be resolved.
#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn get_default_vault_folder(app: tauri::AppHandle) -> Result<String, AppError> {
    let docs = app
        .path()
        .document_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let vault = docs.join("Nout Vault");
    Ok(vault.to_string_lossy().to_string())
}

/// Triggers an in-app update on Android by passing the APK URL to `MainActivity`.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if the JVM or JNI call fails on Android.
#[tauri::command]
pub fn trigger_app_update(apk_url: &str) -> Result<(), AppError> {
    #[cfg(target_os = "android")]
    {
        android_update(apk_url)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = apk_url;
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

/// Opens an external URL via Chrome Custom Tabs on Android, or default handler.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if the URL invocation fails.
#[tauri::command]
pub fn open_external_url(url: &str) -> Result<(), AppError> {
    #[cfg(target_os = "android")]
    {
        android_open_url(url)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = url;
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

/// Retrieves any pending deep link (`nout://...`) from Android activity intent.
///
/// # Errors
///
/// Returns [`AppError::Internal`] if JNI bridge interaction fails.
#[tauri::command]
pub fn get_pending_deep_link() -> Result<Option<String>, AppError> {
    #[cfg(target_os = "android")]
    {
        android_get_pending_deep_link()
    }
    #[cfg(not(target_os = "android"))]
    {
        Ok(None)
    }
}

#[cfg(target_os = "android")]
fn android_get_pending_deep_link() -> Result<Option<String>, AppError> {
    let jvm = crate::get_jvm().ok_or_else(|| {
        AppError::Internal("JVM instance not initialized".to_string())
    })?;

    let mut env = jvm.attach_current_thread().map_err(|e| {
        AppError::Internal(format!("Failed to attach JNI thread: {e}"))
    })?;

    let class = env.find_class("app/nout/desktop/MainActivity").map_err(|e| {
        AppError::Internal(format!("Failed to locate MainActivity: {e}"))
    })?;

    let result = env.call_static_method(
        class,
        "consumePendingDeepLink",
        "()Ljava/lang/String;",
        &[],
    ).map_err(|e| {
        AppError::Internal(format!("Failed to execute consumePendingDeepLink: {e}"))
    })?;

    let obj = result.l().map_err(|e| {
        AppError::Internal(format!("Failed to get Java object from result: {e}"))
    })?;

    if obj.is_null() {
        Ok(None)
    } else {
        let j_str = jni::objects::JString::from(obj);
        let rust_str: String = env.get_string(&j_str).map_err(|e| {
            AppError::Internal(format!("Failed to convert JString to Rust string: {e}"))
        })?.into();
        Ok(Some(rust_str))
    }
}


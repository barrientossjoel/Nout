pub mod commands;
pub mod domain;
pub mod error;
pub mod storage;

use std::fs;
use tauri::Manager;
use crate::storage::db::DatabaseHandle;

pub struct AppState {
    pub db: DatabaseHandle,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Resolver directorio seguro según el SO (Windows, Linux, Android)
            let app_data_dir = app.path().app_data_dir()?;
            if !app_data_dir.exists() {
                fs::create_dir_all(&app_data_dir)?;
            }

            let db_path = app_data_dir.join("nout_local.db");
            let db = DatabaseHandle::new(db_path)
                .map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;

            app.manage(AppState { db });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::documents::get_local_documents,
            commands::documents::get_local_document,
            commands::documents::create_local_document,
            commands::documents::update_local_document,
            commands::documents::delete_local_document,
            commands::documents::save_crdt_delta,
            commands::documents::get_crdt_deltas,
            commands::system::get_platform_info,
            commands::system::pick_vault_folder,
            commands::system::get_default_vault_folder,
        ])
        .run(tauri::generate_context!())?;

    Ok(())
}

use std::collections::HashMap;
use tauri::State;

use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn get_config(
    key: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    state.config_db.get(&key)
}

#[tauri::command]
pub async fn set_config(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.config_db.set(&key, &value)
}

#[tauri::command]
pub async fn delete_config(
    key: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.config_db.delete(&key)
}

#[tauri::command]
pub async fn get_all_config(
    state: State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    state.config_db.get_all()
}

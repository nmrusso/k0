use tauri::State;

use crate::domain::entities::{ContextInfo, NamespaceInfo};
use crate::interfaces::state::AppState;

#[tauri::command]
pub fn get_contexts(state: State<'_, AppState>) -> Result<Vec<ContextInfo>, String> {
    crate::application::handlers::cluster_handler::ClusterHandler::list_contexts(&state.config_db)
        .map_err(Into::into)
}

#[tauri::command]
pub async fn set_active_context(
    name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Abort active pod watcher
    {
        let mut handle = state.pod_watch_handle.lock().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
    }

    crate::application::handlers::cluster_handler::ClusterHandler::set_context(
        &state.client_manager,
        &name,
    )
    .await
    .map_err(Into::into)
}

#[tauri::command]
pub async fn get_namespaces(state: State<'_, AppState>) -> Result<Vec<NamespaceInfo>, String> {
    let client = state.client_manager.get_client_for_context().await.map_err(String::from)?;
    crate::application::handlers::cluster_handler::ClusterHandler::list_namespaces(&client)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn set_active_namespace(
    namespace: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Abort active pod watcher
    {
        let mut handle = state.pod_watch_handle.lock().await;
        if let Some(h) = handle.take() {
            h.abort();
        }
    }

    state.client_manager.set_namespace(&namespace).await;
    Ok(())
}

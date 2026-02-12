use serde_json::Value;
use tauri::State;

use crate::application::handlers::editing_handler::EditingHandler;
use crate::domain::entities::GenericResourceDetailInfo;
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn get_resource_yaml(
    group: String,
    version: String,
    kind: String,
    plural: String,
    name: String,
    cluster_scoped: Option<bool>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    EditingHandler::get_resource_yaml(&client, &ns, &name, &group, &version, &kind, &plural, cluster_scoped.unwrap_or(false))
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn update_resource_yaml(
    group: String,
    version: String,
    kind: String,
    plural: String,
    name: String,
    yaml_content: String,
    cluster_scoped: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    EditingHandler::update_resource_yaml(&client, &ns, &name, &group, &version, &kind, &plural, &yaml_content, cluster_scoped.unwrap_or(false))
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn patch_resource(
    group: String,
    version: String,
    kind: String,
    plural: String,
    name: String,
    patch_json: Value,
    cluster_scoped: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    EditingHandler::patch_resource(&client, &ns, &name, &group, &version, &kind, &plural, &patch_json, cluster_scoped.unwrap_or(false))
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_resource_detail(
    group: String,
    version: String,
    kind: String,
    plural: String,
    name: String,
    cluster_scoped: Option<bool>,
    state: State<'_, AppState>,
) -> Result<GenericResourceDetailInfo, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    EditingHandler::get_generic_resource_detail(&client, &ns, &name, &group, &version, &kind, &plural, cluster_scoped.unwrap_or(false))
        .await
        .map_err(Into::into)
}

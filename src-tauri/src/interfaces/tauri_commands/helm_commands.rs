use tauri::State;

use crate::application::handlers::helm_handler::HelmHandler;
use crate::domain::entities::helm::{HelmRelease, HelmRevision};
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn helm_list_releases(
    state: State<'_, AppState>,
) -> Result<Vec<HelmRelease>, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;
    HelmHandler::list_releases(&ctx, &ns)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn helm_get_history(
    release_name: String,
    state: State<'_, AppState>,
) -> Result<Vec<HelmRevision>, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;
    HelmHandler::get_history(&ctx, &ns, &release_name)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn helm_rollback(
    release_name: String,
    revision: i64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;
    HelmHandler::rollback(&ctx, &ns, &release_name, revision)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn helm_diff_revisions(
    release_name: String,
    from_revision: i64,
    to_revision: i64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;
    HelmHandler::diff_revisions(&ctx, &ns, &release_name, from_revision, to_revision)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn helm_get_values(
    release_name: String,
    revision: i64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;
    HelmHandler::get_values(&ctx, &ns, &release_name, revision)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn helm_get_manifest(
    release_name: String,
    revision: i64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;
    HelmHandler::get_manifest(&ctx, &ns, &release_name, revision)
        .await
        .map_err(Into::into)
}

#[derive(serde::Deserialize)]
struct HelmReleaseConfig {
    path: String,
    #[serde(default)]
    values: Vec<String>,
}

#[tauri::command]
pub async fn helm_diff_local(
    release_name: String,
    revision: i64,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let (_, ns, ctx) = state
        .client_manager
        .get_active_client_and_context()
        .await
        .map_err(String::from)?;

    // Read chart config from config db
    let config_key = format!("helm_chart_paths:{}", ctx);
    let config_value = state
        .config_db
        .get(&config_key)
        .map_err(|e| format!("Failed to read config: {}", e))?;

    let release_config: HelmReleaseConfig = match config_value {
        Some(json_str) => {
            let configs: std::collections::HashMap<String, HelmReleaseConfig> =
                serde_json::from_str(&json_str)
                    .map_err(|e| format!("Failed to parse helm chart paths config: {}", e))?;
            configs.into_iter().find(|(k, _)| k == &release_name).map(|(_, v)| v).ok_or_else(|| {
                format!(
                    "No chart path configured for release '{}'. Configure in Settings.",
                    release_name
                )
            })?
        }
        None => {
            return Err(format!(
                "No chart path configured for release '{}'. Configure in Settings.",
                release_name
            ));
        }
    };

    HelmHandler::diff_local(&ctx, &ns, &release_name, revision, &release_config.path, &release_config.values)
        .await
        .map_err(Into::into)
}

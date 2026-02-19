use tauri::State;

use crate::application::handlers::newrelic_handler::NewRelicHandler;
use crate::domain::entities::newrelic::{
    ActiveAlertsSummary, ContainerUsageSummary, NamespaceMetricsSummary, NodeMetrics, PodMetrics,
};
use crate::interfaces::state::AppState;

const NOT_CONFIGURED_MSG: &str =
    "New Relic not configured. Add API Key and Account ID in Settings.";

/// Returns (api_key, account_id, cluster_name)
fn get_nr_credentials(
    state: &AppState,
    context: &str,
) -> Result<(String, String, String), String> {
    let api_key = state
        .config_db
        .get(&format!("newrelic_api_key:{}", context))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| NOT_CONFIGURED_MSG.to_string())?;
    let account_id = state
        .config_db
        .get(&format!("newrelic_account_id:{}", context))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| NOT_CONFIGURED_MSG.to_string())?;
    let cluster_name = state
        .config_db
        .get(&format!("newrelic_cluster_name:{}", context))
        .map_err(|e| e.to_string())?
        .ok_or_else(|| NOT_CONFIGURED_MSG.to_string())?;
    Ok((api_key, account_id, cluster_name))
}

#[tauri::command]
pub async fn newrelic_get_pod_metrics(
    context: String,
    pod_name: String,
    namespace: String,
    time_range_minutes: u32,
    state: State<'_, AppState>,
) -> Result<PodMetrics, String> {
    let (api_key, account_id, cluster_name) = get_nr_credentials(&state, &context)?;

    NewRelicHandler::get_pod_metrics(&api_key, &account_id, &pod_name, &namespace, &cluster_name, time_range_minutes)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn newrelic_get_namespace_metrics(
    context: String,
    namespace: String,
    time_range_minutes: u32,
    state: State<'_, AppState>,
) -> Result<NamespaceMetricsSummary, String> {
    let (api_key, account_id, cluster_name) = get_nr_credentials(&state, &context)?;

    NewRelicHandler::get_namespace_metrics(&api_key, &account_id, &namespace, &cluster_name, time_range_minutes)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn newrelic_get_node_metrics(
    context: String,
    state: State<'_, AppState>,
) -> Result<Vec<NodeMetrics>, String> {
    let (api_key, account_id, cluster_name) = get_nr_credentials(&state, &context)?;

    NewRelicHandler::get_node_metrics(&api_key, &account_id, &cluster_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn newrelic_get_active_alerts(
    context: String,
    state: State<'_, AppState>,
) -> Result<ActiveAlertsSummary, String> {
    let (api_key, account_id, cluster_name) = get_nr_credentials(&state, &context)?;

    NewRelicHandler::get_active_alerts(&api_key, &account_id, &cluster_name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn newrelic_get_container_usage(
    context: String,
    pod_name: String,
    namespace: String,
    state: State<'_, AppState>,
) -> Result<ContainerUsageSummary, String> {
    let (api_key, account_id, cluster_name) = get_nr_credentials(&state, &context)?;

    NewRelicHandler::get_container_usage(&api_key, &account_id, &pod_name, &namespace, &cluster_name)
        .await
        .map_err(|e| e.to_string())
}

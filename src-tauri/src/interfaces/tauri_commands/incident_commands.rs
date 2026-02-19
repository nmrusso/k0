use tauri::State;

use crate::application::handlers::incident_handler::IncidentHandler;
use crate::domain::entities::incident::*;
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn get_incident_summary(
    state: State<'_, AppState>,
) -> Result<IncidentSummary, String> {
    let (client, ns) = state
        .client_manager
        .get_active_client()
        .await
        .map_err(String::from)?;
    IncidentHandler::get_incident_summary(&client, &ns)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_what_changed(
    since_minutes: u32,
    state: State<'_, AppState>,
) -> Result<Vec<ChangeEvent>, String> {
    let (client, ns) = state
        .client_manager
        .get_active_client()
        .await
        .map_err(String::from)?;
    IncidentHandler::get_what_changed(&client, &ns, since_minutes)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_rollout_timeline(
    deployment_name: String,
    state: State<'_, AppState>,
) -> Result<RolloutTimeline, String> {
    let (client, ns) = state
        .client_manager
        .get_active_client()
        .await
        .map_err(String::from)?;
    IncidentHandler::get_rollout_timeline(&client, &ns, &deployment_name)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn get_namespace_events(
    since_minutes: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<NamespaceEventInfo>, String> {
    let (client, ns) = state
        .client_manager
        .get_active_client()
        .await
        .map_err(String::from)?;
    IncidentHandler::get_namespace_events(&client, &ns, since_minutes)
        .await
        .map_err(Into::into)
}

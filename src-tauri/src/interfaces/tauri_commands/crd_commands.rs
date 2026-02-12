use tauri::State;

use crate::application::handlers::crd_handler::CRDHandler;
use crate::domain::entities::{CRDInfo, CRDInstanceInfo};
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn get_crds(state: State<'_, AppState>) -> Result<Vec<CRDInfo>, String> {
    let client = state
        .client_manager
        .get_client_for_context()
        .await
        .map_err(String::from)?;
    CRDHandler::list_crds(&client).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_crd_instances(
    group: String,
    version: String,
    plural: String,
    scope: String,
    state: State<'_, AppState>,
) -> Result<Vec<CRDInstanceInfo>, String> {
    let (client, ns) = state
        .client_manager
        .get_active_client()
        .await
        .map_err(String::from)?;
    CRDHandler::list_crd_instances(&client, &ns, &group, &version, &plural, &scope)
        .await
        .map_err(Into::into)
}

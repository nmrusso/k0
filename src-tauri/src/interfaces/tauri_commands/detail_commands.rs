use tauri::State;

use crate::application::handlers::{gateway_handler::GatewayHandler, pod_handler::PodHandler};
use crate::domain::entities::*;
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn get_pod_detail(
    name: String,
    state: State<'_, AppState>,
) -> Result<PodDetailInfo, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    PodHandler::get_detail(&client, &ns, &name).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_ingress_detail(
    name: String,
    state: State<'_, AppState>,
) -> Result<IngressDetailInfo, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    GatewayHandler::get_ingress_detail(&client, &ns, &name).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_gateway_detail(
    name: String,
    state: State<'_, AppState>,
) -> Result<GatewayDetailInfo, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    GatewayHandler::get_gateway_detail(&client, &ns, &name).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_httproute_detail(
    name: String,
    state: State<'_, AppState>,
) -> Result<HTTPRouteDetailInfo, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    GatewayHandler::get_httproute_detail(&client, &ns, &name).await.map_err(Into::into)
}

#[tauri::command]
pub async fn get_grpcroute_detail(
    name: String,
    state: State<'_, AppState>,
) -> Result<GRPCRouteDetailInfo, String> {
    let (client, ns) = state.client_manager.get_active_client().await.map_err(String::from)?;
    GatewayHandler::get_grpcroute_detail(&client, &ns, &name).await.map_err(Into::into)
}

use tauri::State;

use crate::application::handlers::minikube_handler::MinikubeHandler;
use crate::domain::entities::minikube::{
    MinikubeAddon, MinikubeProfile, MinikubeServiceEntry, MinikubeStatus,
};
use crate::interfaces::state::AppState;

#[tauri::command]
pub async fn minikube_check_installed() -> Result<bool, String> {
    Ok(MinikubeHandler::check_installed().await)
}

#[tauri::command]
pub async fn minikube_list_profiles() -> Result<Vec<MinikubeProfile>, String> {
    MinikubeHandler::list_profiles().await.map_err(Into::into)
}

#[tauri::command]
pub async fn minikube_get_status(profile: String) -> Result<MinikubeStatus, String> {
    MinikubeHandler::get_status(&profile)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn minikube_start_cluster(
    profile: String,
    cpus: Option<String>,
    memory: Option<String>,
    driver: Option<String>,
    kubernetes_version: Option<String>,
    session_id: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let handle = tokio::spawn(MinikubeHandler::start_cluster(
        profile,
        cpus,
        memory,
        driver,
        kubernetes_version,
        session_id.clone(),
        app_handle,
    ));
    state
        .minikube_sessions
        .lock()
        .await
        .insert(session_id, handle);
    Ok(())
}

#[tauri::command]
pub async fn minikube_stop_cluster(
    profile: String,
    session_id: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let handle = tokio::spawn(MinikubeHandler::stop_cluster(
        profile,
        session_id.clone(),
        app_handle,
    ));
    state
        .minikube_sessions
        .lock()
        .await
        .insert(session_id, handle);
    Ok(())
}

#[tauri::command]
pub async fn minikube_delete_cluster(
    profile: String,
    session_id: String,
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let handle = tokio::spawn(MinikubeHandler::delete_cluster(
        profile,
        session_id.clone(),
        app_handle,
    ));
    state
        .minikube_sessions
        .lock()
        .await
        .insert(session_id, handle);
    Ok(())
}

#[tauri::command]
pub async fn minikube_list_addons(profile: String) -> Result<Vec<MinikubeAddon>, String> {
    MinikubeHandler::list_addons(&profile)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn minikube_toggle_addon(
    profile: String,
    addon_name: String,
    enable: bool,
) -> Result<String, String> {
    MinikubeHandler::toggle_addon(&profile, &addon_name, enable)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn minikube_list_services(
    profile: String,
) -> Result<Vec<MinikubeServiceEntry>, String> {
    MinikubeHandler::list_services(&profile)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn minikube_get_dashboard_url(profile: String) -> Result<String, String> {
    MinikubeHandler::get_dashboard_url(&profile)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn minikube_get_ip(profile: String) -> Result<String, String> {
    MinikubeHandler::get_ip(&profile).await.map_err(Into::into)
}

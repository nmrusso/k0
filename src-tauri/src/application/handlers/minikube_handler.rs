use crate::domain::entities::minikube::{
    MinikubeAddon, MinikubeProfile, MinikubeServiceEntry, MinikubeStatus,
};
use crate::domain::errors::DomainError;
use crate::infrastructure::minikube;

pub struct MinikubeHandler;

impl MinikubeHandler {
    pub async fn check_installed() -> bool {
        minikube::check_installed().await
    }

    pub async fn list_profiles() -> Result<Vec<MinikubeProfile>, DomainError> {
        minikube::list_profiles().await
    }

    pub async fn get_status(profile: &str) -> Result<MinikubeStatus, DomainError> {
        minikube::get_status(profile).await
    }

    pub async fn start_cluster(
        profile: String,
        cpus: Option<String>,
        memory: Option<String>,
        driver: Option<String>,
        kubernetes_version: Option<String>,
        session_id: String,
        app_handle: tauri::AppHandle,
    ) {
        minikube::start_cluster(profile, cpus, memory, driver, kubernetes_version, session_id, app_handle).await
    }

    pub async fn stop_cluster(
        profile: String,
        session_id: String,
        app_handle: tauri::AppHandle,
    ) {
        minikube::stop_cluster(profile, session_id, app_handle).await
    }

    pub async fn delete_cluster(
        profile: String,
        session_id: String,
        app_handle: tauri::AppHandle,
    ) {
        minikube::delete_cluster(profile, session_id, app_handle).await
    }

    pub async fn list_addons(profile: &str) -> Result<Vec<MinikubeAddon>, DomainError> {
        minikube::list_addons(profile).await
    }

    pub async fn toggle_addon(
        profile: &str,
        addon_name: &str,
        enable: bool,
    ) -> Result<String, DomainError> {
        minikube::toggle_addon(profile, addon_name, enable).await
    }

    pub async fn list_services(profile: &str) -> Result<Vec<MinikubeServiceEntry>, DomainError> {
        minikube::list_services(profile).await
    }

    pub async fn get_dashboard_url(profile: &str) -> Result<String, DomainError> {
        minikube::get_dashboard_url(profile).await
    }

    pub async fn get_ip(profile: &str) -> Result<String, DomainError> {
        minikube::get_ip(profile).await
    }
}

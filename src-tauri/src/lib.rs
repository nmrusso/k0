mod application;
mod domain;
mod infrastructure;
mod interfaces;

use interfaces::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_pty::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            // interfaces::tauri_commands::chat_commands::start_chat_session,
            // interfaces::tauri_commands::chat_commands::send_chat_message,
            // interfaces::tauri_commands::chat_commands::stop_chat_session,
            // interfaces::tauri_commands::chat_commands::execute_chat_action,
            interfaces::tauri_commands::cluster_commands::get_contexts,
            interfaces::tauri_commands::cluster_commands::set_active_context,
            interfaces::tauri_commands::cluster_commands::get_namespaces,
            interfaces::tauri_commands::cluster_commands::set_active_namespace,
            interfaces::tauri_commands::resource_commands::get_pods,
            interfaces::tauri_commands::resource_commands::get_deployments,
            interfaces::tauri_commands::resource_commands::get_daemonsets,
            interfaces::tauri_commands::resource_commands::get_statefulsets,
            interfaces::tauri_commands::resource_commands::get_replicasets,
            interfaces::tauri_commands::resource_commands::get_replication_controllers,
            interfaces::tauri_commands::resource_commands::get_jobs,
            interfaces::tauri_commands::resource_commands::get_cronjobs,
            interfaces::tauri_commands::resource_commands::get_services,
            interfaces::tauri_commands::resource_commands::get_configmaps,
            interfaces::tauri_commands::resource_commands::get_secrets,
            interfaces::tauri_commands::resource_commands::get_ingresses,
            interfaces::tauri_commands::resource_commands::get_gateways,
            interfaces::tauri_commands::resource_commands::get_secret_value,
            interfaces::tauri_commands::resource_commands::get_secret_data,
            interfaces::tauri_commands::resource_commands::get_generic_resources,
            interfaces::tauri_commands::resource_commands::get_image_history,
            interfaces::tauri_commands::resource_commands::get_external_secrets_for_deployment,
            interfaces::tauri_commands::resource_commands::force_sync_external_secret,
            interfaces::tauri_commands::resource_commands::get_network_graph,
            interfaces::tauri_commands::resource_commands::get_dependency_graph,
            interfaces::tauri_commands::resource_commands::scale_deployment,
            interfaces::tauri_commands::resource_commands::restart_deployment,
            interfaces::tauri_commands::resource_commands::get_deployment_info,
            interfaces::tauri_commands::resource_commands::update_deployment_resources,
            interfaces::tauri_commands::detail_commands::get_pod_detail,
            interfaces::tauri_commands::detail_commands::get_ingress_detail,
            interfaces::tauri_commands::detail_commands::get_gateway_detail,
            interfaces::tauri_commands::detail_commands::get_httproute_detail,
            interfaces::tauri_commands::detail_commands::get_grpcroute_detail,
            interfaces::tauri_commands::watch_commands::delete_pod,
            interfaces::tauri_commands::watch_commands::start_watching_pods,
            interfaces::tauri_commands::watch_commands::stop_watching_pods,
            interfaces::tauri_commands::watch_commands::exec_pod_shell,
            interfaces::tauri_commands::watch_commands::get_process_env,
            interfaces::tauri_commands::editing_commands::get_resource_yaml,
            interfaces::tauri_commands::editing_commands::update_resource_yaml,
            interfaces::tauri_commands::editing_commands::patch_resource,
            interfaces::tauri_commands::editing_commands::get_resource_detail,
            interfaces::tauri_commands::panel_commands::start_log_stream,
            interfaces::tauri_commands::panel_commands::stop_log_stream,
            interfaces::tauri_commands::crd_commands::get_crds,
            interfaces::tauri_commands::crd_commands::get_crd_instances,
            interfaces::tauri_commands::portforward_commands::start_port_forward,
            interfaces::tauri_commands::portforward_commands::stop_port_forward,
            interfaces::tauri_commands::portforward_commands::list_port_forwards,
            interfaces::tauri_commands::config_commands::get_config,
            interfaces::tauri_commands::config_commands::set_config,
            interfaces::tauri_commands::config_commands::delete_config,
            interfaces::tauri_commands::config_commands::get_all_config,
            interfaces::tauri_commands::incident_commands::get_incident_summary,
            interfaces::tauri_commands::incident_commands::get_what_changed,
            interfaces::tauri_commands::incident_commands::get_rollout_timeline,
            interfaces::tauri_commands::helm_commands::helm_list_releases,
            interfaces::tauri_commands::helm_commands::helm_get_history,
            interfaces::tauri_commands::helm_commands::helm_rollback,
            interfaces::tauri_commands::helm_commands::helm_diff_revisions,
            interfaces::tauri_commands::helm_commands::helm_get_values,
            interfaces::tauri_commands::helm_commands::helm_get_manifest,
            interfaces::tauri_commands::helm_commands::helm_diff_local,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

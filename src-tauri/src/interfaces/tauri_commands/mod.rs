pub mod chat_commands;

/// In release builds, strip the user's home directory from error messages
/// to avoid leaking filesystem structure to the frontend.
#[allow(dead_code)]
pub fn sanitize_error_msg(msg: String) -> String {
    #[cfg(not(debug_assertions))]
    {
        if let Some(home) = dirs::home_dir() {
            let home_str = home.to_string_lossy();
            return msg.replace(home_str.as_ref(), "~");
        }
    }
    msg
}
pub mod cluster_commands;
pub mod config_commands;
pub mod crd_commands;
pub mod detail_commands;
pub mod editing_commands;
pub mod helm_commands;
pub mod incident_commands;
pub mod minikube_commands;
pub mod newrelic_commands;
pub mod panel_commands;
pub mod portforward_commands;
pub mod resource_commands;
pub mod watch_commands;

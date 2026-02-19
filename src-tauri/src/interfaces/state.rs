use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::application::services::config_db::ConfigDB;
use crate::domain::entities::PortForwardEntry;
use crate::infrastructure::kubernetes::client_manager::ClientManager;
use crate::infrastructure::streams::chat_streamer::ChatSession;

pub struct AppState {
    pub client_manager: ClientManager,
    pub pod_watch_handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    pub log_sessions: Arc<Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
    pub chat_sessions: Arc<Mutex<HashMap<String, ChatSession>>>,
    pub port_forwards: Arc<Mutex<HashMap<String, (PortForwardEntry, std::process::Child)>>>,
    pub config_db: Arc<ConfigDB>,
}

impl AppState {
    pub fn new() -> Self {
        let config_db = Arc::new(ConfigDB::new().expect("Failed to initialize config database"));
        Self {
            client_manager: ClientManager::new(config_db.clone()),
            pod_watch_handle: Arc::new(Mutex::new(None)),
            log_sessions: Arc::new(Mutex::new(HashMap::new())),
            chat_sessions: Arc::new(Mutex::new(HashMap::new())),
            port_forwards: Arc::new(Mutex::new(HashMap::new())),
            config_db,
        }
    }
}

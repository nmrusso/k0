use std::collections::HashMap;

use futures::StreamExt;
use k8s_openapi::api::core::v1::Pod;
use kube::runtime::watcher::{self, Event as WatcherEvent};
use kube::{Api, Client};
use tauri::Emitter;
use tokio::time::{Duration, Instant};

use crate::domain::entities::pod::PodInfo;
use crate::infrastructure::kubernetes::pod_repository::{build_rs_to_deployment_map, pod_to_pod_info};

pub async fn run_pod_watcher(
    client: Client,
    namespace: String,
    app_handle: tauri::AppHandle,
) {
    let pod_api: Api<Pod> = Api::namespaced(client.clone(), &namespace);
    let watcher_config = watcher::Config::default();

    let mut pod_cache: HashMap<String, Pod> = HashMap::new();
    let mut rs_map = build_rs_to_deployment_map(&client, &namespace).await;

    let mut stream = watcher::watcher(pod_api, watcher_config).boxed();

    let debounce_duration = Duration::from_millis(300);
    let age_tick = Duration::from_secs(30);
    let mut last_emit = Instant::now() - debounce_duration;
    let mut pending_emit = false;
    let mut age_interval = tokio::time::interval(age_tick);

    loop {
        tokio::select! {
            item = stream.next() => {
                match item {
                    Some(Ok(event)) => {
                        match event {
                            WatcherEvent::Apply(pod) | WatcherEvent::InitApply(pod) => {
                                let name = pod.metadata.name.clone().unwrap_or_default();
                                pod_cache.insert(name, pod);
                            }
                            WatcherEvent::Delete(pod) => {
                                let name = pod.metadata.name.clone().unwrap_or_default();
                                pod_cache.remove(&name);
                            }
                            WatcherEvent::Init => {
                                pod_cache.clear();
                                rs_map = build_rs_to_deployment_map(&client, &namespace).await;
                            }
                            WatcherEvent::InitDone => {}
                        }

                        let now = Instant::now();
                        if now.duration_since(last_emit) >= debounce_duration {
                            emit_pods(&pod_cache, &rs_map, &app_handle);
                            last_emit = now;
                            pending_emit = false;
                        } else {
                            pending_emit = true;
                        }
                    }
                    Some(Err(_)) => {
                        continue;
                    }
                    None => break,
                }
            }
            _ = tokio::time::sleep_until(last_emit + debounce_duration), if pending_emit => {
                emit_pods(&pod_cache, &rs_map, &app_handle);
                last_emit = Instant::now();
                pending_emit = false;
            }
            _ = age_interval.tick() => {
                if !pod_cache.is_empty() {
                    emit_pods(&pod_cache, &rs_map, &app_handle);
                    last_emit = Instant::now();
                }
            }
        }
    }
}

fn emit_pods(
    pod_cache: &HashMap<String, Pod>,
    rs_map: &HashMap<String, (String, String)>,
    app_handle: &tauri::AppHandle,
) {
    let pods: Vec<PodInfo> = pod_cache.values().map(|p| pod_to_pod_info(p, rs_map)).collect();
    let _ = app_handle.emit("pods-changed", &pods);
}

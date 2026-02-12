use chrono::Utc;
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;

use crate::domain::entities::pod::ProbeInfo;

/// Format a K8s Time into a human-readable age string (e.g. "5d", "3h", "10m", "45s").
pub fn format_age(creation: Option<&Time>) -> String {
    match creation {
        Some(t) => {
            let now = Utc::now();
            let created = t.0;
            let duration = now.signed_duration_since(created);

            if duration.num_days() > 0 {
                format!("{}d", duration.num_days())
            } else if duration.num_hours() > 0 {
                format!("{}h", duration.num_hours())
            } else if duration.num_minutes() > 0 {
                format!("{}m", duration.num_minutes())
            } else {
                format!("{}s", duration.num_seconds())
            }
        }
        None => "Unknown".to_string(),
    }
}

/// Format a K8s Probe into a ProbeInfo entity.
pub fn format_probe(probe: &k8s_openapi::api::core::v1::Probe) -> ProbeInfo {
    let (probe_type, details) = if let Some(http) = &probe.http_get {
        let port = match &http.port {
            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(p) => p.to_string(),
            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => s.clone(),
        };
        (
            "http-get".to_string(),
            format!(
                "http://:{}{}", port,
                http.path.clone().unwrap_or_default()
            ),
        )
    } else if let Some(tcp) = &probe.tcp_socket {
        let port = match &tcp.port {
            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::Int(p) => p.to_string(),
            k8s_openapi::apimachinery::pkg::util::intstr::IntOrString::String(s) => s.clone(),
        };
        ("tcp-socket".to_string(), format!(":{}", port))
    } else if let Some(exec) = &probe.exec {
        (
            "exec".to_string(),
            exec.command.clone().unwrap_or_default().join(" "),
        )
    } else {
        ("unknown".to_string(), String::new())
    };

    ProbeInfo {
        probe_type,
        details,
        delay: probe.initial_delay_seconds.unwrap_or(0),
        timeout: probe.timeout_seconds.unwrap_or(1),
        period: probe.period_seconds.unwrap_or(10),
        success_threshold: probe.success_threshold.unwrap_or(1),
        failure_threshold: probe.failure_threshold.unwrap_or(3),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;
    use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;

    fn time_ago(duration: Duration) -> Time {
        Time(Utc::now() - duration)
    }

    #[test]
    fn test_format_age_days() {
        let t = time_ago(Duration::days(5));
        assert_eq!(format_age(Some(&t)), "5d");
    }

    #[test]
    fn test_format_age_hours() {
        let t = time_ago(Duration::hours(3));
        assert_eq!(format_age(Some(&t)), "3h");
    }

    #[test]
    fn test_format_age_minutes() {
        let t = time_ago(Duration::minutes(45));
        assert_eq!(format_age(Some(&t)), "45m");
    }

    #[test]
    fn test_format_age_seconds() {
        let t = time_ago(Duration::seconds(30));
        assert_eq!(format_age(Some(&t)), "30s");
    }

    #[test]
    fn test_format_age_none() {
        assert_eq!(format_age(None), "Unknown");
    }
}

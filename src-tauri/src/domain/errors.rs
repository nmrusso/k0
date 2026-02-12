use std::fmt;

#[derive(Debug)]
pub enum DomainError {
    NotFound(String),
    KubernetesApi(String),
    Configuration(String),
    Serialization(String),
    NoActiveContext,
    NoActiveNamespace,
}

impl fmt::Display for DomainError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DomainError::NotFound(msg) => write!(f, "Not found: {}", msg),
            DomainError::KubernetesApi(msg) => write!(f, "Kubernetes API error: {}", msg),
            DomainError::Configuration(msg) => write!(f, "Configuration error: {}", msg),
            DomainError::Serialization(msg) => write!(f, "Serialization error: {}", msg),
            DomainError::NoActiveContext => write!(f, "No active context"),
            DomainError::NoActiveNamespace => write!(f, "No active namespace"),
        }
    }
}

impl std::error::Error for DomainError {}

impl From<DomainError> for String {
    fn from(e: DomainError) -> String {
        e.to_string()
    }
}

impl From<kube::Error> for DomainError {
    fn from(e: kube::Error) -> Self {
        DomainError::KubernetesApi(e.to_string())
    }
}

impl From<anyhow::Error> for DomainError {
    fn from(e: anyhow::Error) -> Self {
        DomainError::KubernetesApi(e.to_string())
    }
}

impl From<serde_json::Error> for DomainError {
    fn from(e: serde_json::Error) -> Self {
        DomainError::Serialization(e.to_string())
    }
}

impl From<serde_yaml::Error> for DomainError {
    fn from(e: serde_yaml::Error) -> Self {
        DomainError::Serialization(e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_domain_error_display() {
        assert_eq!(
            DomainError::NotFound("pod xyz".to_string()).to_string(),
            "Not found: pod xyz"
        );
        assert_eq!(
            DomainError::NoActiveContext.to_string(),
            "No active context"
        );
        assert_eq!(
            DomainError::NoActiveNamespace.to_string(),
            "No active namespace"
        );
    }

    #[test]
    fn test_domain_error_to_string() {
        let err = DomainError::KubernetesApi("timeout".to_string());
        let s: String = err.into();
        assert_eq!(s, "Kubernetes API error: timeout");
    }
}

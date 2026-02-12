use kube::Client;

use crate::domain::entities::{GRPCRouteDetailInfo, GatewayDetailInfo, HTTPRouteDetailInfo, IngressDetailInfo};
use crate::domain::errors::DomainError;
use crate::infrastructure::kubernetes::{gateway_repository, networking_repository};

pub struct GatewayHandler;

impl GatewayHandler {
    pub async fn get_gateway_detail(
        client: &Client,
        namespace: &str,
        name: &str,
    ) -> Result<GatewayDetailInfo, DomainError> {
        gateway_repository::get_gateway_detail(client, namespace, name).await
    }

    pub async fn get_httproute_detail(
        client: &Client,
        namespace: &str,
        name: &str,
    ) -> Result<HTTPRouteDetailInfo, DomainError> {
        gateway_repository::get_httproute_detail(client, namespace, name).await
    }

    pub async fn get_grpcroute_detail(
        client: &Client,
        namespace: &str,
        name: &str,
    ) -> Result<GRPCRouteDetailInfo, DomainError> {
        gateway_repository::get_grpcroute_detail(client, namespace, name).await
    }

    pub async fn get_ingress_detail(
        client: &Client,
        namespace: &str,
        name: &str,
    ) -> Result<IngressDetailInfo, DomainError> {
        networking_repository::get_ingress_detail(client, namespace, name).await
    }
}

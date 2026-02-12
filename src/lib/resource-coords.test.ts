import { describe, it, expect } from "vitest";
import {
  POD_COORDS,
  DEPLOYMENT_COORDS,
  DAEMONSET_COORDS,
  STATEFULSET_COORDS,
  REPLICASET_COORDS,
  REPLICATIONCONTROLLER_COORDS,
  JOB_COORDS,
  CRONJOB_COORDS,
  SERVICE_COORDS,
  CONFIGMAP_COORDS,
  SECRET_COORDS,
  INGRESS_COORDS,
  GATEWAY_COORDS,
  HTTPROUTE_COORDS,
  GRPCROUTE_COORDS,
  RESOURCE_COORDS_MAP,
} from "./resource-coords";

describe("resource-coords", () => {
  it("core resources use empty group", () => {
    expect(POD_COORDS.group).toBe("");
    expect(SERVICE_COORDS.group).toBe("");
    expect(CONFIGMAP_COORDS.group).toBe("");
    expect(SECRET_COORDS.group).toBe("");
    expect(REPLICATIONCONTROLLER_COORDS.group).toBe("");
  });

  it("apps group resources are correct", () => {
    for (const coords of [DEPLOYMENT_COORDS, DAEMONSET_COORDS, STATEFULSET_COORDS, REPLICASET_COORDS]) {
      expect(coords.group).toBe("apps");
      expect(coords.version).toBe("v1");
    }
  });

  it("batch group resources are correct", () => {
    expect(JOB_COORDS.group).toBe("batch");
    expect(CRONJOB_COORDS.group).toBe("batch");
  });

  it("networking resources are correct", () => {
    expect(INGRESS_COORDS.group).toBe("networking.k8s.io");
    expect(INGRESS_COORDS.plural).toBe("ingresses");
  });

  it("gateway API resources use gateway.networking.k8s.io group", () => {
    for (const coords of [GATEWAY_COORDS, HTTPROUTE_COORDS, GRPCROUTE_COORDS]) {
      expect(coords.group).toBe("gateway.networking.k8s.io");
      expect(coords.version).toBe("v1");
    }
  });

  it("RESOURCE_COORDS_MAP maps resource types to coordinates", () => {
    expect(RESOURCE_COORDS_MAP.pods).toBe(POD_COORDS);
    expect(RESOURCE_COORDS_MAP.deployments).toBe(DEPLOYMENT_COORDS);
    expect(RESOURCE_COORDS_MAP.services).toBe(SERVICE_COORDS);
    expect(RESOURCE_COORDS_MAP.configmaps).toBe(CONFIGMAP_COORDS);
    expect(RESOURCE_COORDS_MAP.secrets).toBe(SECRET_COORDS);
  });

  it("RESOURCE_COORDS_MAP has 31 entries", () => {
    expect(Object.keys(RESOURCE_COORDS_MAP)).toHaveLength(31);
  });

  it("all coords have required fields", () => {
    const allCoords = [
      POD_COORDS, DEPLOYMENT_COORDS, DAEMONSET_COORDS, STATEFULSET_COORDS,
      REPLICASET_COORDS, REPLICATIONCONTROLLER_COORDS, JOB_COORDS, CRONJOB_COORDS,
      SERVICE_COORDS, CONFIGMAP_COORDS, SECRET_COORDS, INGRESS_COORDS,
      GATEWAY_COORDS, HTTPROUTE_COORDS, GRPCROUTE_COORDS,
    ];

    for (const coords of allCoords) {
      expect(coords).toHaveProperty("group");
      expect(coords).toHaveProperty("version");
      expect(coords).toHaveProperty("kind");
      expect(coords).toHaveProperty("plural");
      expect(typeof coords.kind).toBe("string");
      expect(coords.kind.length).toBeGreaterThan(0);
    }
  });
});

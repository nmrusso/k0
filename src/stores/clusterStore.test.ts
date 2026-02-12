import { describe, it, expect, beforeEach } from "vitest";
import { useClusterStore } from "./clusterStore";

describe("clusterStore", () => {
  beforeEach(() => {
    useClusterStore.setState({
      activeContext: null,
      activeNamespace: null,
      activeResource: "pods",
      viewMode: "table",
      selectedPod: null,
      selectedIngress: null,
      selectedGateway: null,
      selectedResourceName: null,
    });
  });

  it("has correct initial state", () => {
    const state = useClusterStore.getState();
    expect(state.activeContext).toBeNull();
    expect(state.activeNamespace).toBeNull();
    expect(state.activeResource).toBe("pods");
    expect(state.viewMode).toBe("table");
  });

  it("setActiveContext clears namespace and selections", () => {
    useClusterStore.getState().setActiveNamespace("default");
    useClusterStore.getState().setSelectedPod("my-pod");
    useClusterStore.getState().setActiveContext("minikube");

    const state = useClusterStore.getState();
    expect(state.activeContext).toBe("minikube");
    expect(state.activeNamespace).toBeNull();
    expect(state.selectedPod).toBeNull();
  });

  it("setActiveNamespace clears selections", () => {
    useClusterStore.getState().setSelectedPod("my-pod");
    useClusterStore.getState().setSelectedIngress("my-ingress");
    useClusterStore.getState().setActiveNamespace("kube-system");

    const state = useClusterStore.getState();
    expect(state.activeNamespace).toBe("kube-system");
    expect(state.selectedPod).toBeNull();
    expect(state.selectedIngress).toBeNull();
  });

  it("setActiveResource clears selections", () => {
    useClusterStore.getState().setSelectedPod("my-pod");
    useClusterStore.getState().setActiveResource("deployments");

    const state = useClusterStore.getState();
    expect(state.activeResource).toBe("deployments");
    expect(state.selectedPod).toBeNull();
  });

  it("setViewMode updates view mode", () => {
    useClusterStore.getState().setViewMode("cards");
    expect(useClusterStore.getState().viewMode).toBe("cards");
  });

  it("selection setters work independently", () => {
    useClusterStore.getState().setSelectedPod("pod-1");
    useClusterStore.getState().setSelectedIngress("ingress-1");
    useClusterStore.getState().setSelectedGateway("gw-1");
    useClusterStore.getState().setSelectedResourceName("deploy-1");

    const state = useClusterStore.getState();
    expect(state.selectedPod).toBe("pod-1");
    expect(state.selectedIngress).toBe("ingress-1");
    expect(state.selectedGateway).toBe("gw-1");
    expect(state.selectedResourceName).toBe("deploy-1");
  });
});

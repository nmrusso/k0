import { create } from "zustand";
import type { ResourceType } from "@/types/k8s";

export type ViewMode = "table" | "cards";

interface ClusterState {
  activeContext: string | null;
  activeNamespace: string | null;
  activeResource: ResourceType;
  viewMode: ViewMode;
  selectedPod: string | null;
  selectedIngress: string | null;
  selectedGateway: string | null;
  selectedResourceName: string | null;
  setActiveContext: (context: string | null) => void;
  setActiveNamespace: (namespace: string | null) => void;
  setActiveResource: (resource: ResourceType) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedPod: (name: string | null) => void;
  setSelectedIngress: (name: string | null) => void;
  setSelectedGateway: (name: string | null) => void;
  setSelectedResourceName: (name: string | null) => void;
}

const CLEAR_SELECTIONS = {
  selectedPod: null,
  selectedIngress: null,
  selectedGateway: null,
  selectedResourceName: null,
};

export const useClusterStore = create<ClusterState>((set) => ({
  activeContext: null,
  activeNamespace: null,
  activeResource: "pods",
  viewMode: "table",
  selectedPod: null,
  selectedIngress: null,
  selectedGateway: null,
  selectedResourceName: null,
  setActiveContext: (context) =>
    set({ activeContext: context, activeNamespace: null, ...CLEAR_SELECTIONS }),
  setActiveNamespace: (namespace) =>
    set({ activeNamespace: namespace, ...CLEAR_SELECTIONS }),
  setActiveResource: (resource) => set({ activeResource: resource, ...CLEAR_SELECTIONS }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedPod: (name) => set({ selectedPod: name }),
  setSelectedIngress: (name) => set({ selectedIngress: name }),
  setSelectedGateway: (name) => set({ selectedGateway: name }),
  setSelectedResourceName: (name) => set({ selectedResourceName: name }),
}));

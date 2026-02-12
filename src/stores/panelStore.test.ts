import { describe, it, expect, beforeEach } from "vitest";
import { usePanelStore } from "./panelStore";

describe("panelStore", () => {
  beforeEach(() => {
    usePanelStore.setState({
      isOpen: false,
      height: 300,
      tabs: [],
      activeTabId: null,
    });
  });

  it("has correct initial state", () => {
    const state = usePanelStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.height).toBe(300);
    expect(state.tabs).toHaveLength(0);
    expect(state.activeTabId).toBeNull();
  });

  it("togglePanel flips isOpen", () => {
    usePanelStore.getState().togglePanel();
    expect(usePanelStore.getState().isOpen).toBe(true);
    usePanelStore.getState().togglePanel();
    expect(usePanelStore.getState().isOpen).toBe(false);
  });

  it("setHeight updates height", () => {
    usePanelStore.getState().setHeight(500);
    expect(usePanelStore.getState().height).toBe(500);
  });

  it("openLogTab creates tab and opens panel", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "my-pod",
      title: "my-pod",
    });

    const state = usePanelStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(id);
    expect(state.tabs[0].type).toBe("logs");
    expect(state.tabs[0].targetName).toBe("my-pod");
    expect(state.tabs[0].isStreaming).toBe(true);
    expect(state.tabs[0].isFollowing).toBe(true);
    expect(state.tabs[0].lines).toEqual([]);
  });

  it("openShellTab creates shell tab", () => {
    const id = usePanelStore.getState().openShellTab({
      podName: "my-pod",
      containerName: "main",
      context: "my-ctx",
      namespace: "default",
      title: "shell: my-pod/main",
    });

    const state = usePanelStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].type).toBe("shell");
    expect(state.tabs[0].podName).toBe("my-pod");
    expect(state.activeTabId).toBe(id);
  });

  it("closeTab removes tab and selects last remaining", () => {
    const id1 = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });
    const id2 = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-2",
      title: "pod-2",
    });

    usePanelStore.getState().closeTab(id2);
    const state = usePanelStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(id1);
    expect(state.isOpen).toBe(true);
  });

  it("closeTab closes panel when last tab removed", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });

    usePanelStore.getState().closeTab(id);
    const state = usePanelStore.getState();
    expect(state.tabs).toHaveLength(0);
    expect(state.activeTabId).toBeNull();
    expect(state.isOpen).toBe(false);
  });

  it("appendLogLines adds lines to correct tab", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });

    usePanelStore.getState().appendLogLines(id, ["line1", "line2"]);
    usePanelStore.getState().appendLogLines(id, ["line3"]);

    const tab = usePanelStore.getState().tabs[0];
    expect(tab.lines).toEqual(["line1", "line2", "line3"]);
  });

  it("clearLogLines empties lines", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });

    usePanelStore.getState().appendLogLines(id, ["line1"]);
    usePanelStore.getState().clearLogLines(id);
    expect(usePanelStore.getState().tabs[0].lines).toEqual([]);
  });

  it("setFollowing updates following state", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });

    usePanelStore.getState().setFollowing(id, false);
    expect(usePanelStore.getState().tabs[0].isFollowing).toBe(false);
  });

  it("setStreaming updates streaming state", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });

    usePanelStore.getState().setStreaming(id, false);
    expect(usePanelStore.getState().tabs[0].isStreaming).toBe(false);
  });

  it("setSelectedContainer updates container", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });

    usePanelStore.getState().setSelectedContainer(id, "sidecar");
    expect(usePanelStore.getState().tabs[0].selectedContainer).toBe("sidecar");
  });

  it("setAvailableContainers updates containers list", () => {
    const id = usePanelStore.getState().openLogTab({
      targetKind: "pod",
      targetName: "pod-1",
      title: "pod-1",
    });

    usePanelStore.getState().setAvailableContainers(id, ["main", "sidecar"]);
    expect(usePanelStore.getState().tabs[0].availableContainers).toEqual([
      "main",
      "sidecar",
    ]);
  });
});

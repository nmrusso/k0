import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ResourceView } from "@/components/resources/ResourceView";
import { BottomPanel } from "@/components/panel/BottomPanel";

export function MainLayout() {
  return (
    <div className="flex h-screen flex-col">
      <TopBar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-background p-4">
            <ResourceView />
          </main>
        </div>
        <BottomPanel />
      </div>
    </div>
  );
}

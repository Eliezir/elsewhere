import { Tabs } from "@base-ui/react/tabs";
import { VmTargetSchema } from "@vmc/shared";
import { MotionConfig } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { NAV_ITEMS, isNavId, type NavId } from "@/lib/nav";
import { NavProvider } from "@/lib/nav-context";
import { useSettings } from "@/lib/settings";
import { OverviewView } from "@/views/OverviewView";
import { PopoverView } from "@/views/PopoverView";
import { QueueView } from "@/views/QueueView";
import { SettingsView } from "@/views/SettingsView";
import { UsageView } from "@/views/UsageView";
import { VmView } from "@/views/VmView";
import { WorktreesView } from "@/views/WorktreesView";

const VIEWS: Record<NavId, ReactNode> = {
  overview: <OverviewView />,
  worktrees: <WorktreesView />,
  vm: <VmView />,
  usage: <UsageView />,
  queue: <QueueView />,
  settings: <SettingsView />,
};

function MainWindow() {
  const [active, setActive] = useState<NavId>("overview");
  const [settings] = useSettings();

  useEffect(() => {
    const target = VmTargetSchema.safeParse({ host: settings.host.trim(), user: settings.user.trim() });
    void window.api.setForwardConfig({ target: target.success ? target.data : null, autoForward: settings.autoForward });
  }, [settings.host, settings.user, settings.autoForward]);

  useEffect(() => {
    void window.api.setAppPrefs({ startAtLogin: settings.startAtLogin, runInBackground: settings.runInBackground, showInMenuBar: settings.showInMenuBar });
  }, [settings.startAtLogin, settings.runInBackground, settings.showInMenuBar]);

  useEffect(
    () =>
      window.api.onNavigate((section) => {
        if (isNavId(section)) setActive(section);
      }),
    [],
  );

  return (
    <NavProvider value={setActive}>
    <Tabs.Root
      value={active}
      onValueChange={(value) => {
        if (typeof value === "string" && isNavId(value)) setActive(value);
      }}
      className="flex h-full flex-col eclipse-bg"
    >
      <TopBar active={active} />
      <main className="min-h-0 flex-1 px-4 pb-4">
        {NAV_ITEMS.map((item) => (
          <Tabs.Panel key={item.id} value={item.id} className="h-full outline-none">
            {VIEWS[item.id]}
          </Tabs.Panel>
        ))}
      </main>
    </Tabs.Root>
    </NavProvider>
  );
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      {window.location.hash === "#/popover" ? <PopoverView /> : <MainWindow />}
    </MotionConfig>
  );
}

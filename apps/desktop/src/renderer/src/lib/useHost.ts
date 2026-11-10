import { activeOf, hostKind, type HostKind } from "./hosts";
import { useSettings } from "./settings";

export function useHostName(): string {
  const [settings] = useSettings();
  return activeOf(settings).name.trim() || "VM";
}

export function useHostKind(): HostKind {
  const [settings] = useSettings();
  return hostKind(activeOf(settings));
}

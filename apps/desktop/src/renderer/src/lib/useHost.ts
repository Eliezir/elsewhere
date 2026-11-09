import { activeOf } from "./hosts";
import { useSettings } from "./settings";

export function useHostName(): string {
  const [settings] = useSettings();
  return activeOf(settings).name.trim() || "VM";
}

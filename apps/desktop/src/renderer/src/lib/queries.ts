import { useQuery } from "@tanstack/react-query";
import { useSettings } from "./settings";

export function useTailscaleStatus() {
  const [settings] = useSettings();
  const vmName = settings.host.trim().split(".")[0] ?? "";
  return useQuery({
    queryKey: ["tailscale-status", vmName],
    queryFn: () => window.api.getTailscaleStatus(vmName === "" ? undefined : vmName),
    refetchInterval: 5000,
  });
}

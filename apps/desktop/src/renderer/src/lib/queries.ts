import { useQuery } from "@tanstack/react-query";

export function useTailscaleStatus() {
  return useQuery({
    queryKey: ["tailscale-status"],
    queryFn: () => window.api.getTailscaleStatus(),
    refetchInterval: 5000,
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { TailscaleControlResult } from "@vmc/shared";
import { useTailscaleStatus } from "./queries";

export type TailscaleAction = "connect" | "disconnect";

export function messageFor(result: TailscaleControlResult, action: TailscaleAction): string | null {
  if (result.ok) return null;
  if (result.signInStarted) return "Finish signing in in your browser, then come back.";
  return result.error ?? (action === "connect" ? "Tailscale didn't connect." : "Tailscale didn't disconnect.");
}

export function useTailscaleControl() {
  const queryClient = useQueryClient();
  const { data: status } = useTailscaleStatus();
  const mutation = useMutation({
    mutationFn: (action: TailscaleAction) => (action === "connect" ? window.api.connectTailscale() : window.api.disconnectTailscale()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["tailscale-status"] });
      void queryClient.invalidateQueries({ queryKey: ["vm-snapshot"] });
    },
  });

  const run = (action: TailscaleAction) => mutation.mutate(action);
  const message = mutation.data && mutation.variables ? messageFor(mutation.data, mutation.variables) : mutation.isError ? "The request couldn't be sent." : null;
  const needsLogin = status?.backend === "NeedsLogin";
  const connected = status?.state === "connected";

  return { status, connected, needsLogin, busy: mutation.isPending, message, connect: () => run("connect"), disconnect: () => run("disconnect") };
}

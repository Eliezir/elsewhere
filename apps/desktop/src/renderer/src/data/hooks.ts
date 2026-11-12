import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { VmTargetSchema, type LinkStatus } from "@vmc/shared";
import { splitLines, useSettings } from "@/lib/settings";
import type { Worktree } from "./types";


export function useMacWorktrees() {
  const [settings] = useSettings();
  const repos = splitLines(settings.macRepos);
  return useQuery({
    queryKey: ["mac-worktrees", repos],
    queryFn: () => window.api.getMacWorktrees(repos),
    refetchInterval: 60000,
    staleTime: 30000,
    retry: false,
  });
}

export function useVmSnapshot() {
  const [settings] = useSettings();
  const target = { host: settings.host.trim(), user: settings.user.trim() };
  const repos = splitLines(settings.vmRepos);
  return useQuery({
    queryKey: ["vm-snapshot", target.host, target.user, repos],
    queryFn: () => window.api.getVmSnapshot({ target, repos }),
    enabled: VmTargetSchema.safeParse(target).success,
    refetchInterval: 60000,
    staleTime: 30000,
    retry: false,
  });
}

export function useProjectIcons() {
  const mac = useMacWorktrees();
  const seen = new Set<string>();
  const projects = (mac.data ?? []).flatMap((tree) => {
    if (seen.has(tree.repo)) return [];
    seen.add(tree.repo);
    return [{ repo: tree.repo, path: tree.path }];
  });
  const key = projects.map((project) => `${project.repo}:${project.path}`).join("|");
  return useQuery({
    queryKey: ["project-icons", key],
    queryFn: () => window.api.getProjectIcons({ projects }),
    enabled: projects.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useWorktreeSizes(worktrees: readonly Worktree[], vmReachable: boolean) {
  const [settings] = useSettings();
  const mac = worktrees.filter((tree) => tree.location === "mac").map((tree) => tree.path);
  const vm = worktrees.filter((tree) => tree.location === "vm").map((tree) => tree.path);
  const target = { host: settings.host.trim(), user: settings.user.trim() };
  const input = { mac, vm: vmReachable && vm.length > 0 ? { target, paths: vm } : null };
  return useQuery({
    queryKey: ["worktree-sizes", mac, input.vm?.paths ?? null],
    queryFn: () => window.api.getWorktreeSizes(input),
    enabled: mac.length > 0 || input.vm !== null,
    refetchInterval: (query) => ((query.state.data?.pending ?? 1) > 0 ? 3000 : 60000),
    staleTime: 0,
    retry: false,
  });
}

export function useTools() {
  return useQuery({ queryKey: ["tools"], queryFn: () => window.api.getTools(), staleTime: 10 * 60 * 1000, retry: false });
}

export function useT3Threads(paths: readonly string[]) {
  return useQuery({
    queryKey: ["t3-threads", paths],
    queryFn: () => window.api.getT3Threads([...paths]),
    enabled: paths.length > 0,
    staleTime: 20000,
    refetchInterval: 60000,
    retry: false,
  });
}

export function useWorktrees() {
  const mac = useMacWorktrees();
  const vm = useVmSnapshot();
  const worktrees: Worktree[] = [...(mac.data ?? []), ...(vm.data?.worktrees ?? [])].sort((a, b) => b.lastActive - a.lastActive);
  return { worktrees, mac, vm };
}

export function useMacStorage() {
  return useQuery({ queryKey: ["mac-storage"], queryFn: () => window.api.getMacStorage(), staleTime: 5 * 60 * 1000, retry: false });
}

export function useHostStorage(host: string, user: string) {
  const target = { host: host.trim(), user: user.trim() };
  return useQuery({
    queryKey: ["vm-storage", target.host, target.user],
    queryFn: () => window.api.getVmStorage({ target }),
    enabled: VmTargetSchema.safeParse(target).success,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useShutdownStatus(host: string, user: string) {
  const target = { host: host.trim(), user: user.trim() };
  return useQuery({
    queryKey: ["shutdown-status", target.host, target.user],
    queryFn: () => window.api.getShutdownStatus({ target }),
    enabled: VmTargetSchema.safeParse(target).success,
    refetchInterval: 15000,
    staleTime: 5000,
    retry: false,
  });
}

export function useHostAppStatus(host: string, user: string) {
  const target = { host: host.trim(), user: user.trim() };
  return useQuery({
    queryKey: ["host-app", "lan-mouse", target.host, target.user],
    queryFn: () => window.api.controlHostApp({ target, app: "lan-mouse", action: "status" }),
    enabled: VmTargetSchema.safeParse(target).success,
    refetchInterval: 10000,
    staleTime: 4000,
    retry: false,
  });
}

export function useLanMouse() {
  return useQuery({
    queryKey: ["lan-mouse"],
    queryFn: () => window.api.controlLanMouse({ action: "status" }),
    refetchInterval: 4000,
    staleTime: 2000,
    retry: false,
  });
}

export function useTwinSync(mac: Worktree | null, vm: Worktree | null, enabled: boolean) {
  const [settings] = useSettings();
  const target = { host: settings.host.trim(), user: settings.user.trim() };
  const input = mac && vm && mac.branch ? { target, branch: mac.branch, macPath: mac.path, vmPath: vm.path } : null;
  return useQuery({
    queryKey: ["twin-sync", mac?.path, vm?.path, mac?.head, vm?.head],
    queryFn: () => (input ? window.api.compareTwins(input) : Promise.reject(new Error("No pair"))),
    enabled: enabled && input !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLinkStatus(): LinkStatus {
  const [status, setStatus] = useState<LinkStatus>({ state: "unknown", approvalUrl: null, message: null });
  useEffect(() => {
    void window.api.getLinkStatus().then(setStatus);
    return window.api.onLinkStatus(setStatus);
  }, []);
  return status;
}

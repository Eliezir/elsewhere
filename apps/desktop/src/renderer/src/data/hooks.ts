import { useQuery } from "@tanstack/react-query";
import { VmTargetSchema } from "@vmc/shared";
import { splitLines, useSettings } from "@/lib/settings";
import { toUsageData } from "@/lib/usage";
import { SAMPLE_IDLE, SAMPLE_PACER, SAMPLE_TASKS } from "./mock";
import type { Worktree } from "./types";

function useSample<T>(key: string, value: T) {
  return useQuery({ queryKey: ["sample", key], queryFn: () => Promise.resolve(value), staleTime: Infinity });
}

export function useUsage() {
  return useQuery({
    queryKey: ["usage"],
    queryFn: () => window.api.getUsage(),
    refetchInterval: 15000,
    select: (snapshot) => toUsageData(snapshot, Math.floor(Date.now() / 1000)),
  });
}
export const useIdleHealth = () => useSample("idle", SAMPLE_IDLE);
export const useQueueTasks = () => useSample("tasks", SAMPLE_TASKS);
export const usePacer = () => useSample("pacer", SAMPLE_PACER);

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

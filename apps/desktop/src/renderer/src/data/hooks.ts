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

export function useWorktrees() {
  const mac = useMacWorktrees();
  const vm = useVmSnapshot();
  const worktrees: Worktree[] = [...(mac.data ?? []), ...(vm.data?.worktrees ?? [])].sort((a, b) => b.lastActive - a.lastActive);
  return { worktrees, mac, vm };
}

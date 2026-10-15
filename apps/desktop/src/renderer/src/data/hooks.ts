import { useQuery } from "@tanstack/react-query";
import { toUsageData } from "@/lib/usage";
import { SAMPLE_IDLE, SAMPLE_PACER, SAMPLE_TASKS, SAMPLE_VM, SAMPLE_WORKTREES } from "./mock";

function useSample<T>(key: string, value: T) {
  return useQuery({ queryKey: ["sample", key], queryFn: () => Promise.resolve(value), staleTime: Infinity });
}

export const useWorktrees = () => useSample("worktrees", SAMPLE_WORKTREES);
export function useUsage() {
  return useQuery({
    queryKey: ["usage"],
    queryFn: () => window.api.getUsage(),
    refetchInterval: 15000,
    select: (snapshot) => toUsageData(snapshot, Math.floor(Date.now() / 1000)),
  });
}
export const useVmHealth = () => useSample("vm", SAMPLE_VM);
export const useIdleHealth = () => useSample("idle", SAMPLE_IDLE);
export const useQueueTasks = () => useSample("tasks", SAMPLE_TASKS);
export const usePacer = () => useSample("pacer", SAMPLE_PACER);

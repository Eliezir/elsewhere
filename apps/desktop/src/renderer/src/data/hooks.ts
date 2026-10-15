import { useQuery } from "@tanstack/react-query";
import { SAMPLE_IDLE, SAMPLE_PACER, SAMPLE_TASKS, SAMPLE_USAGE, SAMPLE_VM, SAMPLE_WORKTREES } from "./mock";

function useSample<T>(key: string, value: T) {
  return useQuery({ queryKey: ["sample", key], queryFn: () => Promise.resolve(value), staleTime: Infinity });
}

export const useWorktrees = () => useSample("worktrees", SAMPLE_WORKTREES);
export const useUsage = () => useSample("usage", SAMPLE_USAGE);
export const useVmHealth = () => useSample("vm", SAMPLE_VM);
export const useIdleHealth = () => useSample("idle", SAMPLE_IDLE);
export const useQueueTasks = () => useSample("tasks", SAMPLE_TASKS);
export const usePacer = () => useSample("pacer", SAMPLE_PACER);

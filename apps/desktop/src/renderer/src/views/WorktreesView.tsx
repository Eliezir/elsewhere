import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApproveSshButton } from "@/components/ApproveSshButton";
import { CleanupDialog } from "@/components/CleanupDialog";
import { ConnectTailscaleButton } from "@/components/ConnectTailscaleButton";
import { useProjectIcons, useT3Threads, useTools, useWorktreeSizes, useWorktrees } from "@/data/hooks";
import type { Worktree } from "@/data/types";
import { useWorktreeNames } from "@/lib/aliases";
import { originOf, type Origin } from "@/lib/origin";
import { useSettings } from "@/lib/settings";
import { staleInfo } from "@/lib/stale";
import { groupByProject } from "@/lib/worktreeModel";
import { ProjectPage } from "./worktrees/ProjectPage";
import { ProjectsHome } from "./worktrees/ProjectsHome";

let lastProject: string | null = null;

export function WorktreesView() {
  const queryClient = useQueryClient();
  const { worktrees, mac, vm } = useWorktrees();
  const icons = useProjectIcons().data ?? {};
  const tools = useTools().data;
  const t3Threads = useT3Threads(worktrees.filter((tree) => tree.location === "mac").map((tree) => tree.path)).data ?? {};
  const originFor = (tree: Worktree): Origin => originOf(tree, t3Threads[tree.path] !== undefined);
  const [settings] = useSettings();
  const [names, setName] = useWorktreeNames();
  const sizes = useWorktreeSizes(worktrees, vm.data?.reachable ?? false).data?.sizes ?? {};
  const [project, setProject] = useState<string | null>(lastProject);
  const [cleanupTrees, setCleanupTrees] = useState<Worktree[] | null>(null);
  const now = Math.floor(Date.now() / 1000);

  const groups = useMemo(() => groupByProject(worktrees, sizes, now, settings.staleDays), [worktrees, sizes, now, settings.staleDays]);
  const open = project === null ? null : (groups.find((group) => group.repo === project) ?? null);
  const vmProblem = vm.data && !vm.data.reachable ? vm.data.error : null;

  const choose = (repo: string | null) => {
    lastProject = repo;
    setProject(repo);
  };

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["mac-worktrees"] });
    void queryClient.invalidateQueries({ queryKey: ["vm-snapshot"] });
  };

  const problem = vmProblem ? (
    <div className="flex items-start justify-between gap-3 rounded-xl bg-[var(--inset)] px-3 py-2">
      <span className="text-xs text-[var(--warn)]">{`VM: ${vmProblem}`}</span>
      {vm.data?.approvalUrl ? <ApproveSshButton url={vm.data.approvalUrl} className="max-w-[55%] shrink-0 justify-end" /> : <ConnectTailscaleButton className="max-w-[55%] shrink-0 justify-end" />}
    </div>
  ) : null;

  const staleEntries = (trees: readonly Worktree[]) => trees.map((tree) => ({ tree, info: staleInfo(tree, settings.staleDays) })).filter((entry) => entry.info.stale);

  return (
    <div className="h-full">
      {open ? (
        <ProjectPage
          key={open.repo}
          repo={open.repo}
          trees={open.trees}
          all={worktrees}
          icons={icons}
          tools={tools}
          t3Threads={t3Threads}
          originFor={originFor}
          sizes={sizes}
          vm={vm.data}
          now={now}
          names={names}
          problem={problem}
          onAlias={setName}
          onBack={() => choose(null)}
          onChanged={refresh}
          onCleanup={setCleanupTrees}
        />
      ) : (
        <ProjectsHome groups={groups} sizes={sizes} icons={icons} now={now} days={settings.staleDays} loading={mac.isPending} problem={problem} onOpen={choose} onCleanup={() => setCleanupTrees(worktrees)} />
      )}
      <CleanupDialog open={cleanupTrees !== null} onOpenChange={(value) => !value && setCleanupTrees(null)} entries={staleEntries(cleanupTrees ?? [])} sizes={sizes} icons={icons} vmReachable={vm.data?.reachable ?? false} onChanged={refresh} />
    </div>
  );
}

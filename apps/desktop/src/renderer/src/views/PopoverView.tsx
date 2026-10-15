import { motion } from "motion/react";
import type { ReactNode } from "react";
import mark from "@/assets/mark.png";
import { Meter } from "@/components/charts";
import { Button } from "@/components/controls";
import { ProjectIcon } from "@/components/ProjectIcon";
import { useProjectIcons } from "@/data/hooks";
import { ConnectTailscaleButton } from "@/components/ConnectTailscaleButton";
import { Pill } from "@/components/Tile";
import type { NavId } from "@/lib/nav";
import type { Health } from "@/lib/status";
import { useOverviewModel } from "./overview/model";
import { NoUsage } from "./overview/parts";

const DOT: Record<Health, string> = {
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  down: "bg-[var(--down)]",
  unknown: "bg-[var(--text-muted)]",
};

function open(section?: NavId) {
  void window.api.openMainWindow(section);
}

function Card({ title, to, action, index, children }: { title: string; to: NavId; action?: ReactNode; index: number; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay: index * 0.05 }}
      className="rounded-2xl border border-[var(--hairline)] bg-[var(--glass)] p-3.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.06)]"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => open(to)}
          className="group flex cursor-default items-center gap-1 text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]"
        >
          {title}
          <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5">
            ›
          </span>
        </button>
        {action}
      </div>
      {children}
    </motion.section>
  );
}

function Stat({ label, value, unit, percent, color }: { label: string; value: string; unit: string; percent: number; color?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
      <div className="mb-1.5 mt-0.5 text-2xl font-medium leading-none tracking-tight">
        {value}
        <span className="ml-0.5 text-sm text-[var(--text-secondary)]">{unit}</span>
      </div>
      <Meter value={percent} color={color} />
    </div>
  );
}

export function PopoverView() {
  const model = useOverviewModel();
  const icons = useProjectIcons().data ?? {};
  const { connection, usage, vm, idle, worktrees, queue } = model;
  const running = queue.find((job) => job.state === "running");
  const waiting = queue.filter((job) => job.state === "waiting").length;
  const reachable = connection.health === "ok";

  return (
    <div className="eclipse-bg-soft flex h-full flex-col overflow-hidden rounded-[18px] border border-[var(--hairline)]">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <img src={mark} alt="" className="size-8 rounded-[9px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium leading-tight">adt-dev</span>
            <span aria-hidden="true" className={`size-2 rounded-full transition-colors duration-300 ${DOT[connection.health]}`} />
          </div>
          <motion.div
            key={connection.headline}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="truncate text-xs text-[var(--text-secondary)]"
          >
            {connection.headline}
          </motion.div>
        </div>
        {idle?.atRisk && <Pill tone="warn">idle risk</Pill>}
      </header>
      {connection.health !== "ok" && !vm && (
        <div className="mx-3 mb-1 mt-1 rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] px-3.5 py-2.5">
          <ConnectTailscaleButton />
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-2">
        <Card index={0} title="Claude usage" to="usage" action={usage?.fiveHourResets && <Pill>{`resets in ${usage.fiveHourResets}`}</Pill>}>
          {usage && (usage.fiveHour !== null || usage.weekly !== null) ? (
            <div className="flex gap-5">
              <Stat label="5-hour" value={usage.fiveHour === null ? "–" : String(usage.fiveHour)} unit="%" percent={usage.fiveHour ?? 0} color="var(--accent)" />
              <Stat label="Weekly" value={usage.weekly === null ? "–" : String(usage.weekly)} unit="%" percent={usage.weekly ?? 0} color="var(--accent)" />
            </div>
          ) : (
            <NoUsage />
          )}
        </Card>
        <Card index={1} title="VM health" to="overview" action={vm && <Pill>{`${connection.latencyMs ?? "–"} ms`}</Pill>}>
          {vm ? (
            <div className="flex gap-4">
              <Stat label="CPU" value={String(vm.cpu)} unit="%" percent={vm.cpu} color="var(--ok)" />
              <Stat label="Memory" value={String(Math.round((vm.memUsedGb / vm.memTotalGb) * 100))} unit="%" percent={(vm.memUsedGb / vm.memTotalGb) * 100} color="var(--ok)" />
              <Stat label="Disk" value={String(Math.round((vm.diskUsedGb / vm.diskTotalGb) * 100))} unit="%" percent={(vm.diskUsedGb / vm.diskTotalGb) * 100} color="var(--ok)" />
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">{reachable ? "VM health isn't available yet." : `${connection.headline}.`}</p>
          )}
        </Card>
        <Card index={2} title="Queue" to="queue" action={queue.length > 0 && <Pill>{`${running ? 1 : 0} running · ${waiting} waiting`}</Pill>}>
          {queue.length > 0 ? (
            <div className="flex items-center gap-2.5">
              <span className={`size-2 shrink-0 rounded-full ${running ? "animate-pulse bg-[var(--ok)]" : "bg-white/30"}`} />
              <div className="min-w-0">
                <div className="truncate">{running?.title ?? "Waiting for headroom"}</div>
                <div className="truncate text-xs text-[var(--text-secondary)]">{running?.detail ?? `${waiting} tasks queued`}</div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">{reachable ? "No tasks queued." : "The queue lives on the VM."}</p>
          )}
        </Card>
        <Card index={3} title="Worktrees" to="worktrees" action={<Pill>{String(worktrees.length)}</Pill>}>
          <div className="space-y-1.5">
            {worktrees.slice(0, 3).map((tree) => (
              <div key={`${tree.location}-${tree.name}`} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5">
                  <ProjectIcon repo={tree.repo} icon={icons[tree.repo]} size="sm" />
                  <span className="truncate">{tree.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">{tree.detail.split("·")[1]?.trim()}</span>
                  <Pill tone={tree.location === "vm" ? "ok" : "neutral"}>{tree.location === "vm" ? "VM" : "Mac"}</Pill>
                </span>
              </div>
            ))}
            {worktrees.length === 0 && <p className="text-xs text-[var(--text-muted)]">No worktrees found.</p>}
          </div>
        </Card>
      </main>
      <footer className="flex gap-2 border-t border-[var(--hairline)] p-3">
        <Button variant="primary" onClick={() => open()} className="flex-1">
          Open VM Companion
        </Button>
        <Button onClick={() => open("queue")}>Add task</Button>
      </footer>
    </div>
  );
}

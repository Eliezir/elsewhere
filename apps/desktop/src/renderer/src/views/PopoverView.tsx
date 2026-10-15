import { motion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import type { VmPort } from "@vmc/shared";
import mark from "@/assets/mark.png";
import { Meter } from "@/components/charts";
import { ClaudeMark } from "@/components/ClaudeMark";
import { Button } from "@/components/controls";
import { ProjectIcon } from "@/components/ProjectIcon";
import { useProjectIcons, useVmPorts, useVmSnapshot } from "@/data/hooks";
import { groupPorts } from "@/lib/ports";
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

const MAX_GROUPS = 3;
const MAX_CHIPS = 3;

function PortChip({ port }: { port: VmPort }) {
  const forwarded = port.state === "active" || port.state === "remapped";
  return (
    <button
      type="button"
      onClick={() => forwarded && port.localPort !== null && void window.api.openLocalPort(port.localPort)}
      title={forwarded ? `Open localhost:${port.localPort}` : "Not forwarded"}
      className={`no-drag flex cursor-default items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--inset)] px-2 py-0.5 text-[11px] tabular-nums outline-none transition-colors duration-200 ${forwarded ? "hover:bg-white/10" : "text-[var(--text-muted)]"}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${forwarded ? "bg-[var(--ok)]" : "bg-white/25"}`} />
      {port.port}
    </button>
  );
}

function open(section?: NavId) {
  void window.api.openMainWindow(section);
}

function Card({ title, icon, to, action, index, children }: { title: string; icon?: ReactNode; to: NavId; action?: ReactNode; index: number; children: ReactNode }) {
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
          className="group flex cursor-default items-center gap-1.5 text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]"
        >
          {icon}
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
  const { connection, usage, vm, idle } = model;
  const ports = useVmPorts();
  const snapshot = useVmSnapshot();
  const projectPorts = (ports.data?.ports ?? []).filter((port) => port.kind === "project");
  const groups = useMemo(() => groupPorts(projectPorts, snapshot.data?.worktrees ?? []), [projectPorts, snapshot.data]);
  const projectCount = groups.length;
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
      <main className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden px-3 py-2">
        <Card index={0} title="Claude usage" icon={<ClaudeMark />} to="usage" action={usage?.fiveHourResets && <Pill>{`resets in ${usage.fiveHourResets}`}</Pill>}>
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
        <Card index={2} title="Ports" to="vm" action={<Pill>{`${projectCount} ${projectCount === 1 ? "project" : "projects"}`}</Pill>}>
          {groups.length > 0 ? (
            <div className="space-y-2.5">
              {groups.slice(0, MAX_GROUPS).map((group) => (
                <div key={group.key} className="flex items-center gap-2.5">
                  <ProjectIcon repo={group.repo} icon={icons[group.repo]?.icon} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate leading-tight">{`${group.repo} · ${group.name}`}</div>
                    {group.branch !== null && <div className="truncate text-[11px] leading-tight text-[var(--text-secondary)]">{group.branch}</div>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {group.ports.slice(0, MAX_CHIPS).map((port) => (
                      <PortChip key={port.port} port={port} />
                    ))}
                    {group.ports.length > MAX_CHIPS && <span className="self-center text-[11px] text-[var(--text-secondary)]">{`+${group.ports.length - MAX_CHIPS}`}</span>}
                  </div>
                </div>
              ))}
              {groups.length > MAX_GROUPS && (
                <button type="button" onClick={() => open("vm")} className="no-drag cursor-default text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 hover:text-[var(--text-primary)]">
                  {`+${groups.length - MAX_GROUPS} more`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">{reachable ? "Nothing is running on the VM." : "Ports show up once the VM is reachable."}</p>
          )}
        </Card>
      </main>
      <footer className="flex gap-2 border-t border-[var(--hairline)] p-3">
        <Button variant="primary" onClick={() => open()} className="flex-1">
          Open Elsewhere
        </Button>
        <Button onClick={() => open("vm")}>Ports</Button>
      </footer>
    </div>
  );
}

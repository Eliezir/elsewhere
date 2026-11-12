import { useHostKind, useHostName } from "@/lib/useHost";
import { motion } from "motion/react";
import { type ReactNode } from "react";
import mark from "@/assets/mark.png";
import { Meter } from "@/components/charts";
import { LanMouseQuick } from "@/components/LanMouseQuick";
import { PopoverGamingMode } from "@/components/PopoverGamingMode";
import { Button } from "@/components/controls";
import { useLinkStatus } from "@/data/hooks";
import { ApproveSshButton } from "@/components/ApproveSshButton";

import { ConnectTailscaleButton } from "@/components/ConnectTailscaleButton";
import { Pill } from "@/components/Tile";
import type { NavId } from "@/lib/nav";
import type { Health } from "@/lib/status";
import { useOverviewModel } from "./overview/model";

const DOT: Record<Health, string> = {
  ok: "bg-[var(--ok)]",
  warn: "bg-[var(--warn)]",
  down: "bg-[var(--down)]",
  unknown: "bg-[var(--text-muted)]",
};

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
  const { connection, vm } = model;
  const link = useLinkStatus();
  const host = useHostName();
  const kind = useHostKind();
  const health: Health = link.state === "approval" ? "warn" : link.state === "offline" ? "down" : connection.health;
  const headline = link.state === "approval" ? "Tailscale SSH needs your approval" : link.state === "offline" ? `Can't reach ${host}` : connection.headline;
  const reachable = link.state === "unknown" ? connection.health === "ok" : link.state === "ok";

  return (
    <div className="eclipse-bg-soft flex h-full flex-col overflow-hidden rounded-[18px] border border-[var(--hairline)]">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <img src={mark} alt="" className="size-8 rounded-[9px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium leading-tight">{host}</span>
            <span aria-hidden="true" className={`size-2 rounded-full transition-colors duration-300 ${DOT[health]}`} />
          </div>
          <motion.div
            key={headline}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="truncate text-xs text-[var(--text-secondary)]"
          >
            {headline}
          </motion.div>
        </div>
      </header>
      {link.state === "approval" && link.approvalUrl !== null && (
        <div className="mx-3 mb-1 mt-1 rounded-2xl border border-[var(--warn)]/40 bg-[var(--inset)] px-3.5 py-2.5">
          <div className="mb-2 text-xs leading-snug text-[var(--warn)]">Tailscale SSH needs your approval before it lets this Mac in. Ports and {host} stay disconnected until you approve.</div>
          <ApproveSshButton url={link.approvalUrl} />
        </div>
      )}
      {link.state === "offline" && connection.health === "ok" && (
        <div className="mx-3 mb-1 mt-1 rounded-2xl border border-[var(--down)]/40 bg-[var(--inset)] px-3.5 py-2.5 text-xs leading-snug text-[var(--down)]">{link.message ?? "Can't reach the VM."}</div>
      )}
      {connection.health !== "ok" && !vm && link.state !== "approval" && (
        <div className="mx-3 mb-1 mt-1 rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] px-3.5 py-2.5">
          <ConnectTailscaleButton />
        </div>
      )}
      <main className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-2">
        <Card index={1} title={`${host} health`} to="overview" action={vm && <Pill>{`${connection.latencyMs ?? "–"} ms`}</Pill>}>
          {vm ? (
            <div className="flex gap-4">
              <Stat label="CPU" value={String(vm.cpu)} unit="%" percent={vm.cpu} color="var(--ok)" />
              <Stat label="Memory" value={String(Math.round((vm.memUsedGb / vm.memTotalGb) * 100))} unit="%" percent={(vm.memUsedGb / vm.memTotalGb) * 100} color="var(--ok)" />
              <Stat label="Disk" value={String(Math.round((vm.diskUsedGb / vm.diskTotalGb) * 100))} unit="%" percent={(vm.diskUsedGb / vm.diskTotalGb) * 100} color="var(--ok)" />
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)]">{reachable ? `${host} health isn't available yet.` : `${connection.headline}.`}</p>
          )}
        </Card>
        {kind === "pc" && (
          <Card index={2} title="PC mode" to="overview">
            <PopoverGamingMode />
          </Card>
        )}
        {kind === "pc" && (
          <Card index={3} title="Lan Mouse" to="settings">
            <LanMouseQuick />
          </Card>
        )}
      </main>
      <footer className="flex gap-2 border-t border-[var(--hairline)] p-3">
        <Button variant="primary" onClick={() => open()} className="flex-1">
          Open Elsewhere
        </Button>
      </footer>
    </div>
  );
}

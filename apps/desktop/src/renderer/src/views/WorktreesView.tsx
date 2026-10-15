import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Button, Segmented, ToggleRow } from "@/components/controls";
import { Pill, Tile } from "@/components/Tile";
import { useWorktrees } from "@/data/hooks";
import type { Location, Worktree } from "@/data/types";

type Filter = "all" | Location;

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mac", label: "Mac" },
  { value: "vm", label: "VM" },
] as const;

const PLACE: Record<Location, string> = { mac: "Mac", vm: "VM" };

function Chip({ children, tone }: { children: string; tone?: "warn" }) {
  return (
    <span className={`rounded-full bg-[var(--inset)] px-2 py-0.5 text-[11px] ${tone === "warn" ? "text-[var(--warn)]" : "text-[var(--text-secondary)]"}`}>
      {children}
    </span>
  );
}

function Row({ tree, selected, index, onSelect }: { tree: Worktree; selected: boolean; index: number; onSelect: () => void }) {
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      onClick={onSelect}
      className={`no-drag flex w-full cursor-default items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left outline-none transition-colors duration-200 ${selected ? "border-[var(--accent)] bg-[var(--accent)]/15" : "border-[var(--hairline)] bg-[var(--inset)] hover:bg-white/5"}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px]">{tree.name}</span>
          <Pill tone={tree.location === "vm" ? "ok" : "neutral"}>{PLACE[tree.location]}</Pill>
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{tree.branch}</div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {tree.modified > 0 && <Chip tone="warn">{`${tree.modified} modified`}</Chip>}
        {(tree.ahead > 0 || tree.behind > 0) && <Chip>{`↑${tree.ahead} ↓${tree.behind}`}</Chip>}
        <Chip>{`${tree.sessions.length} ${tree.sessions.length === 1 ? "session" : "sessions"}`}</Chip>
      </div>
    </motion.button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--inset)] px-3 py-2.5">
      <div className="text-lg font-medium">{value}</div>
      <div className="text-[11px] text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}

function MovePlan({ tree }: { tree: Worktree }) {
  const target: Location = tree.location === "mac" ? "vm" : "mac";
  const [withEnv, setWithEnv] = useState(false);
  const [withData, setWithData] = useState(false);

  const steps = [
    tree.modified > 0 ? `Commit ${tree.modified} modified ${tree.modified === 1 ? "file" : "files"} as a WIP commit` : null,
    `Push ${tree.branch} to the ${PLACE[target]} over SSH`,
    `Create the worktree on the ${PLACE[target]}`,
    `Copy ${tree.sessions.length} Claude ${tree.sessions.length === 1 ? "session" : "sessions"} with paths rewritten`,
    withEnv ? "Copy .env files" : null,
    withData && tree.largeDir ? `Copy ${tree.largeDir.name} (${tree.largeDir.size})` : null,
  ].filter((step): step is string => step !== null);

  return (
    <div className="mt-auto">
      <div className="mb-1 text-xs text-[var(--text-secondary)]">{`Move to the ${PLACE[target]}`}</div>
      {tree.hasEnv && <ToggleRow label="Include .env files" hint="Secrets stay behind unless you opt in." checked={withEnv} onChange={setWithEnv} />}
      {tree.largeDir && (
        <ToggleRow label={`Include ${tree.largeDir.name}`} hint={`Large data, ${tree.largeDir.size}.`} checked={withData} onChange={setWithData} />
      )}
      <ol className="my-3 space-y-1.5 text-xs text-[var(--text-secondary)]">
        <AnimatePresence initial={false}>
          {steps.map((step, i) => (
            <motion.li
              key={step}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="flex gap-2 overflow-hidden"
            >
              <span className="w-4 shrink-0 tabular-nums text-[var(--text-muted)]">{i + 1}</span>
              <span>{step}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      <Button variant="primary" disabled className="w-full">
        {`Move to the ${PLACE[target]}`}
      </Button>
      <p className="mt-2 text-center text-[11px] text-[var(--text-muted)]">Moving runs through the VM daemon, which isn't built yet.</p>
    </div>
  );
}

export function WorktreesView() {
  const { data: trees = [] } = useWorktrees();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visible = trees.filter((tree) => filter === "all" || tree.location === filter);
  const selected = visible.find((tree) => tree.id === selectedId) ?? visible[0] ?? null;

  return (
    <div className="grid h-full grid-cols-12 gap-3">
      <Tile
        className="col-span-7"
        title="Worktrees"
        action={<Segmented id="worktree-filter" label="Location" options={FILTERS} value={filter} onChange={setFilter} />}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.map((tree, i) => (
              <Row key={tree.id} tree={tree} index={i} selected={tree.id === selected?.id} onSelect={() => setSelectedId(tree.id)} />
            ))}
          </AnimatePresence>
          {visible.length === 0 && <p className="text-xs text-[var(--text-muted)]">No worktrees on the {filter === "vm" ? "VM" : "Mac"} yet.</p>}
        </div>
      </Tile>
      <Tile className="col-span-5" tone="light" index={1} title="Selected" action={selected && <Pill>{PLACE[selected.location]}</Pill>}>
        {selected ? (
          <div key={selected.id} className="flex min-h-0 flex-1 flex-col">
            <div className="text-3xl font-medium leading-tight">{selected.name}</div>
            <div className="mt-1 truncate text-xs text-[var(--text-secondary)]">{selected.path}</div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat label="Modified" value={String(selected.modified)} />
              <Stat label="Ahead · behind" value={`${selected.ahead} · ${selected.behind}`} />
              <Stat label="Last active" value={selected.lastActive.replace(" ago", "")} />
            </div>
            <div className="mb-1.5 mt-4 text-xs text-[var(--text-secondary)]">Claude sessions</div>
            <div className="space-y-1.5 overflow-y-auto">
              {selected.sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--inset)] px-3 py-2">
                  <span className="truncate">{session.title}</span>
                  <span className="shrink-0 text-[11px] text-[var(--text-secondary)]">{`${session.messages} msgs · ${session.lastActive}`}</span>
                </div>
              ))}
            </div>
            <MovePlan tree={selected} />
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">Select a worktree to see its sessions and move it.</p>
        )}
      </Tile>
    </div>
  );
}

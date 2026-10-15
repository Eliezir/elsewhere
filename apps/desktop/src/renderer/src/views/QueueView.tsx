import { Accordion } from "@base-ui/react/accordion";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toggle } from "@base-ui/react/toggle";
import { useState } from "react";
import { Button, Segmented, SelectField, TextField, ToggleRow } from "@/components/controls";
import { Meter } from "@/components/charts";
import { Pill, Tile } from "@/components/Tile";
import { usePacer, useQueueTasks, useUsage } from "@/data/hooks";
import { REPOS } from "@/data/mock";
import type { Priority, QueueTask, TaskState } from "@/data/types";
import { useSettings } from "@/lib/settings";

type Filter = "all" | "active" | "finished";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "finished", label: "Finished" },
] as const;

const PRIORITIES: readonly Priority[] = ["low", "normal", "high"];

const DOT: Record<TaskState, string> = {
  running: "bg-[var(--ok)] animate-pulse",
  waiting: "bg-white/30",
  done: "bg-[var(--accent)]",
  failed: "bg-[var(--down)]",
  cancelled: "bg-white/15",
};

const STATE_LABEL: Record<TaskState, string> = {
  running: "running",
  waiting: "waiting",
  done: "done",
  failed: "failed",
  cancelled: "cancelled",
};

function matches(task: QueueTask, filter: Filter): boolean {
  if (filter === "all") return true;
  const active = task.state === "running" || task.state === "waiting";
  return filter === "active" ? active : !active;
}

function TaskRow({ task, onChange }: { task: QueueTask; onChange: (state: TaskState) => void }) {
  const canCancel = task.state === "running" || task.state === "waiting";
  const canRetry = task.state === "failed" || task.state === "cancelled";
  return (
    <Accordion.Item value={task.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--inset)]">
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full cursor-default items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none transition-colors duration-200 hover:bg-white/5">
          <span className={`size-2 shrink-0 rounded-full ${DOT[task.state]}`} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{task.title}</span>
            <span className="block truncate text-xs text-[var(--text-secondary)]">{`${task.repo} · ${task.branch}`}</span>
          </span>
          <Pill tone={task.priority === "high" ? "warn" : "neutral"}>{task.priority}</Pill>
          <span className="w-16 text-right text-xs text-[var(--text-secondary)]">{STATE_LABEL[task.state]}</span>
          <span aria-hidden="true" className="text-[var(--text-secondary)] transition-transform duration-300 group-data-[panel-open]:rotate-180">
            ⌄
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-300 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
        <div className="px-4 pb-4">
          <p className="text-xs text-[var(--text-secondary)]">{`${task.detail} · ${task.estimate}`}</p>
          {task.log.length > 0 && (
            <pre className="mt-3 overflow-x-auto rounded-xl bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
              {task.log.join("\n")}
            </pre>
          )}
          {(canCancel || canRetry) && (
            <div className="mt-3 flex gap-2">
              {canCancel && <Button onClick={() => onChange("cancelled")}>Cancel</Button>}
              {canRetry && <Button onClick={() => onChange("waiting")}>Retry</Button>}
            </div>
          )}
        </div>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

function AddTask({ onAdd }: { onAdd: (task: QueueTask) => void }) {
  const [title, setTitle] = useState("");
  const [repo, setRepo] = useState<string>(REPOS[0]);
  const [priority, setPriority] = useState<Priority>("normal");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd({
      id: `t-${Date.now()}`,
      title: trimmed,
      repo,
      branch: `agent/${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 28)}`,
      state: "waiting",
      priority,
      estimate: "~10 min",
      detail: "Waits for headroom, then runs on the VM in its own worktree.",
      log: [],
    });
    setTitle("");
  };

  return (
    <Tile index={2} className="min-h-0 flex-1" title="Add a task">
      <form
        className="flex min-h-0 flex-1 flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField label="What should the agent do?" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Review the settings page copy" />
        <SelectField label="Repository" value={repo} onChange={(event) => setRepo(event.target.value)}>
          {REPOS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </SelectField>
        <div>
          <span className="mb-1 block text-xs text-[var(--text-secondary)]">Priority</span>
          <ToggleGroup
            value={[priority]}
            onValueChange={(next) => {
              const value = next[0];
              if (value === "low" || value === "normal" || value === "high") setPriority(value);
            }}
            className="flex gap-1 rounded-full border border-[var(--hairline)] bg-[var(--inset)] p-0.5"
          >
            {PRIORITIES.map((value) => (
              <Toggle
                key={value}
                value={value}
                className="flex-1 cursor-default rounded-full px-3 py-1 text-xs text-[var(--text-secondary)] outline-none transition-colors duration-200 data-[pressed]:bg-[var(--accent)]/35 data-[pressed]:text-[var(--text-primary)]"
              >
                {value}
              </Toggle>
            ))}
          </ToggleGroup>
        </div>
        <Button variant="primary" type="submit" disabled={title.trim() === ""} className="mt-auto">
          Queue task
        </Button>
      </form>
    </Tile>
  );
}

export function QueueView() {
  const { data: initial = [] } = useQueueTasks();
  const { data: usage } = useUsage();
  const { data: pacer } = usePacer();
  const [settings] = useSettings();
  const [edited, setEdited] = useState<readonly QueueTask[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const tasks = edited ?? initial;
  const visible = tasks.filter((task) => matches(task, filter));
  const waiting = tasks.filter((task) => task.state === "waiting").length;
  const running = tasks.filter((task) => task.state === "running").length;
  const fiveHour = usage?.fiveHour ?? 0;
  const releasing = enabled && fiveHour < settings.pacerCap && (pacer?.releasing ?? false);

  const setState = (id: string, state: TaskState) => setEdited(tasks.map((task) => (task.id === id ? { ...task, state } : task)));

  return (
    <div className="grid h-full grid-cols-12 gap-3">
      <div className="col-span-4 flex min-h-0 flex-col gap-3">
        <Tile tone="light" title="Pacer" action={<Pill tone={releasing ? "ok" : "warn"}>{releasing ? "releasing" : "holding"}</Pill>} className="shrink-0">
          <div className="text-3xl font-medium leading-tight">{releasing ? "Running tasks as headroom allows" : enabled ? "Holding tasks for now" : "Pacer is off"}</div>
          <p className="mb-4 mt-2 text-xs text-[var(--text-secondary)]">
            {enabled ? (fiveHour < settings.pacerCap ? (pacer?.reason ?? "") : "The 5-hour window is above the cap.") : "Nothing is released until you turn it on."}
          </p>
          <div className="relative">
            <Meter value={fiveHour} />
            <div className="absolute -top-1 h-3.5 w-px bg-white/60" style={{ left: `${settings.pacerCap}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-xs text-[var(--text-secondary)]">
            <span>{`5-hour window ${fiveHour}%`}</span>
            <span>{`cap ${settings.pacerCap}%`}</span>
          </div>
          <ToggleRow label="Run tasks automatically" checked={enabled} onChange={setEnabled} />
        </Tile>
        <AddTask onAdd={(task) => setEdited([task, ...tasks])} />
      </div>
      <Tile
        className="col-span-8"
        index={1}
        title="Tasks"
        action={
          <div className="flex items-center gap-2">
            <Pill>{`${running} running · ${waiting} waiting`}</Pill>
            <Segmented id="queue-filter" label="Filter" options={FILTERS} value={filter} onChange={setFilter} />
          </div>
        }
      >
        <Accordion.Root className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} onChange={(state) => setState(task.id, state)} />
          ))}
          {visible.length === 0 && <p className="text-xs text-[var(--text-muted)]">Nothing here. Add a task and it will wait for headroom.</p>}
        </Accordion.Root>
      </Tile>
    </div>
  );
}

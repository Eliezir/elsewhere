import { useQueryClient } from "@tanstack/react-query";
import { TaskKeySchema } from "@vmc/shared";
import { useMemo, useState } from "react";
import { Meter } from "@/components/charts";
import { Button, FIELD, SelectField } from "@/components/controls";
import { TaskEditor } from "@/components/TaskEditor";
import { Pill, Tile } from "@/components/Tile";
import { useMacWorktrees, useTasks } from "@/data/hooks";
import { filterGroups, groupTasks, suggestedKey } from "@/lib/taskModel";

function NewTask({ onCreated }: { onCreated: (key: string) => void }) {
  const trees = useMacWorktrees().data ?? [];
  const queryClient = useQueryClient();
  const [path, setPath] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chosen = trees.find((tree) => tree.path === path) ?? trees[0];
  const valid = TaskKeySchema.safeParse(key.trim()).success;

  const create = async () => {
    if (!chosen) return;
    const result = await window.api.createTask({ worktree: chosen.path, key: key.trim() });
    if (!result.ok) {
      setError(result.error ?? "Couldn't create the task.");
      return;
    }
    setError(null);
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    onCreated(key.trim());
    setKey("");
  };

  return (
    <div className="space-y-2 border-t border-[var(--hairline)] pt-3">
      <SelectField
        label="Worktree"
        value={chosen?.path ?? ""}
        onChange={(event) => {
          setPath(event.target.value);
          setKey(suggestedKey(trees.find((tree) => tree.path === event.target.value)?.branch ?? null));
        }}
      >
        {trees.map((tree) => (
          <option key={tree.path} value={tree.path}>{`${tree.repo} · ${tree.branch ?? tree.name}`}</option>
        ))}
      </SelectField>
      <input
        aria-label="Task key"
        placeholder={suggestedKey(chosen?.branch ?? null) || "Task key, like ABC-123"}
        value={key}
        onChange={(event) => setKey(event.target.value)}
        className={`${FIELD} w-full`}
      />
      <Button variant="primary" disabled={!chosen || !valid} onClick={() => void create()} className="w-full">
        Add task board
      </Button>
      {error && <p className="text-xs text-[var(--warn)]">{error}</p>}
    </div>
  );
}

export function TasksView() {
  const tasks = useTasks();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const groups = useMemo(() => groupTasks(tasks.data ?? []), [tasks.data]);
  const shown = filterGroups(groups, query);
  const current = groups.find((group) => group.key === selected) ?? shown[0] ?? null;

  return (
    <div className="grid h-full grid-cols-12 gap-3">
      <Tile className="col-span-4" title="Tasks" action={<Pill>{`${groups.length} ${groups.length === 1 ? "task" : "tasks"}`}</Pill>}>
        <input aria-label="Search tasks" placeholder="Search by key, title or branch" value={query} onChange={(event) => setQuery(event.target.value)} className={`${FIELD} mb-2 w-full`} />
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1 text-[13px]">
          {tasks.isPending && <li className="py-2 text-xs text-[var(--text-muted)]">Looking through your worktrees…</li>}
          {!tasks.isPending && shown.length === 0 && <li className="py-2 text-xs text-[var(--text-muted)]">{groups.length === 0 ? "No task boards yet. Add one below, or let an agent create .context/<key>/TASKS.md." : "Nothing matches that search."}</li>}
          {shown.map((group) => {
            const total = group.open + group.done;
            const active = current?.key === group.key;
            return (
              <li key={group.key}>
                <button
                  type="button"
                  onClick={() => setSelected(group.key)}
                  className={`no-drag w-full cursor-default rounded-xl px-3 py-2 text-left outline-none transition-colors duration-200 ${active ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{group.key}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-secondary)]">{`${group.open} open`}</span>
                  </div>
                  <div className="mb-1.5 truncate text-[11px] text-[var(--text-secondary)]">{`${group.title === group.key ? "" : `${group.title} · `}${group.threads.length} ${group.threads.length === 1 ? "worktree" : "worktrees"}`}</div>
                  <Meter value={total === 0 ? 0 : (group.done / total) * 100} color="var(--ok)" />
                </button>
              </li>
            );
          })}
        </ul>
        <NewTask onCreated={setSelected} />
      </Tile>
      <Tile className="col-span-8" index={1} title={current ? `${current.key} · ${current.title}` : "Details"}>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {current ? current.threads.map((thread) => <TaskEditor key={thread.file} entry={thread} />) : <p className="text-xs text-[var(--text-muted)]">Pick a task to see its notes and checklist.</p>}
        </div>
      </Tile>
    </div>
  );
}

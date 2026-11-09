import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { TaskEntry } from "@vmc/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { Meter } from "@/components/charts";
import { FIELD } from "@/components/controls";
import { homeRelative } from "@/lib/storageHistory";
import { checklistOf, toggleLine } from "@/lib/taskModel";

const SAVE_DELAY_MS = 700;

export function TaskEditor({ entry }: { entry: TaskEntry }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const key = useMemo(() => ["task", entry.file] as const, [entry.file]);
  const file = useQuery({ queryKey: key, queryFn: () => window.api.readTask(entry.file), refetchInterval: draft === null ? 4000 : false, retry: false });
  const text = draft ?? file.data?.content ?? "";
  const items = checklistOf(text);
  const done = items.filter((item) => item.done).length;

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const save = async (content: string) => {
    const result = await window.api.writeTask({ file: entry.file, content });
    if (!result.ok) {
      setError(result.error ?? "Couldn't save.");
      return;
    }
    setError(null);
    queryClient.setQueryData(key, result);
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    setDraft(null);
  };

  const edit = (content: string, immediate: boolean) => {
    setDraft(content);
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (immediate) void save(content);
    else timer.current = window.setTimeout(() => void save(content), SAVE_DELAY_MS);
  };

  return (
    <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] p-3.5">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm">{entry.branch ?? entry.repo}</div>
          <div className="truncate text-[11px] text-[var(--text-secondary)]">{homeRelative(entry.worktree)}</div>
        </div>
        <div className="w-24 shrink-0 text-right text-[11px] tabular-nums text-[var(--text-secondary)]">
          <div className="mb-1">{`${done} of ${items.length} done`}</div>
          <Meter value={items.length === 0 ? 0 : (done / items.length) * 100} color="var(--ok)" />
        </div>
      </header>
      {items.length > 0 && (
        <ul className="mb-2 space-y-0.5 text-[13px]">
          {items.map((item) => (
            <li key={item.line}>
              <button
                type="button"
                onClick={() => edit(toggleLine(text, item.line), true)}
                className="no-drag flex w-full cursor-default items-start gap-2 rounded-lg px-1.5 py-1 text-left outline-none transition-colors duration-200 hover:bg-white/5"
              >
                <span aria-hidden="true" className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors duration-200 ${item.done ? "border-[var(--ok)] bg-[var(--ok)]/25 text-[var(--ok)]" : "border-white/25"}`}>
                  {item.done ? "✓" : ""}
                </span>
                <span className={`transition-colors duration-200 ${item.done ? "text-[var(--text-muted)] line-through" : ""}`}>{item.text === "" ? "(empty)" : item.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <textarea
        aria-label={`Notes for ${entry.branch ?? entry.repo}`}
        value={text}
        onChange={(event) => edit(event.target.value, false)}
        spellCheck={false}
        rows={Math.min(18, Math.max(6, text.split("\n").length + 1))}
        className={`${FIELD} w-full resize-y font-mono text-xs leading-relaxed`}
      />
      <div className="mt-1.5 h-4 text-[11px] text-[var(--text-secondary)]">{error ?? (draft === null ? (file.data?.ok === false ? file.data.error : "Saved · picks up changes the agent makes") : "Saving…")}</div>
    </section>
  );
}

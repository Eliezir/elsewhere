import { Pill, Tile } from "./Tile";
import { Loadable } from "@/views/overview/parts";
import type { OverviewModel } from "@/views/overview/model";

export function QueueHero({ model }: { model: OverviewModel }) {
  const current = model.queue.find((job) => job.state === "running");
  const waiting = model.queue.filter((job) => job.state !== "running");

  return (
    <Tile
      tone="light"
      index={5}
      className="min-h-0 flex-1"
      title="Queue"
      action={model.queue.length > 0 ? <Pill>{`${current ? 1 : 0} running · ${waiting.length} waiting`}</Pill> : undefined}
    >
      <Loadable model={model}>
        {model.queue.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No jobs queued. Add a task and it will wait for headroom.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className={`size-2 rounded-full ${current ? "bg-[var(--ok)]" : "bg-white/25"}`} />
              {current ? "Running now" : "Nothing running"}
            </div>
            <div className="mt-1 text-3xl font-medium leading-tight">{current?.title ?? "Waiting for headroom"}</div>
            <div className="mb-4 mt-1 text-xs text-[var(--text-secondary)]">{current?.detail}</div>
            <div className="mb-2 text-xs text-[var(--text-secondary)]">Up next</div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {waiting.map((job) => (
                <div
                  key={job.title}
                  className="flex min-h-[72px] flex-1 flex-col justify-between rounded-2xl border border-[var(--hairline)] bg-[var(--inset)] p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">Waiting</span>
                    <span className="size-2 rounded-full bg-white/25" />
                  </div>
                  <div>
                    <div>{job.title}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{job.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Loadable>
    </Tile>
  );
}

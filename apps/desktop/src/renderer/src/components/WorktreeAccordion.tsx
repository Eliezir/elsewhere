import { Accordion } from "@base-ui/react/accordion";
import { ConnectTailscaleButton } from "./ConnectTailscaleButton";
import { Tile } from "./Tile";
import type { OverviewModel } from "@/views/overview/model";

interface Row {
  value: string;
  title: string;
  summary: string;
  lines: readonly { name: string; detail: string }[];
}

function rowsFor(model: OverviewModel): Row[] {
  const { connection } = model;
  const mac = model.worktrees.filter((tree) => tree.location === "mac");
  const vm = model.worktrees.filter((tree) => tree.location === "vm");
  return [
    {
      value: "connection",
      title: "Connection",
      summary: connection.ip ?? "—",
      lines: [
        { name: "Status", detail: connection.headline },
        { name: "This Mac", detail: connection.selfName ?? "unknown" },
        { name: "VM address", detail: connection.dnsName ?? "not found" },
      ],
    },
    { value: "mac", title: "Mac worktrees", summary: String(mac.length), lines: mac },
    { value: "vm", title: "VM worktrees", summary: String(vm.length), lines: vm },
  ];
}

export function WorktreeAccordion({ model }: { model: OverviewModel }) {
  return (
    <Tile index={4} className="max-h-[52%] shrink-0 overflow-y-auto !p-1.5">
      <Accordion.Root defaultValue={["connection"]} className="flex flex-col">
        {rowsFor(model).map((row) => (
          <Accordion.Item key={row.value} value={row.value} className="rounded-2xl">
            <Accordion.Header>
              <Accordion.Trigger className="group flex w-full cursor-default items-center justify-between rounded-2xl px-3 py-3 text-left outline-none transition-colors duration-200 hover:bg-white/5">
                <span>{row.title}</span>
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  {row.summary}
                  <span aria-hidden="true" className="transition-transform duration-300 group-data-[panel-open]:rotate-180">
                    ⌄
                  </span>
                </span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel className="h-[var(--accordion-panel-height)] overflow-hidden transition-[height] duration-300 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
              <div className="space-y-1 px-3 pb-3 text-xs">
                {row.lines.length === 0 && <p className="text-[var(--text-muted)]">Nothing here yet.</p>}
                {row.value === "connection" && <ConnectTailscaleButton className="pt-2" />}
                {row.lines.map((line) => (
                  <div key={line.name} className="flex justify-between gap-3">
                    <span>{line.name}</span>
                    <span className="truncate text-[var(--text-secondary)]">{line.detail}</span>
                  </div>
                ))}
              </div>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </Tile>
  );
}

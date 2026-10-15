import type { Worktree } from "@vmc/shared";
import { parseStatus, parseWorktreeList } from "./git";
import { titleFromTranscript } from "./sessions";
import { shq } from "./ssh";

export interface VmHealthReading {
  cpu: number;
  cores: number;
  memUsedGb: number;
  memTotalGb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  uptimeSeconds: number;
  claudeInstalled: boolean;
  gitVersion: string | null;
}

export interface VmSnapshotData {
  health: VmHealthReading | null;
  worktrees: Worktree[];
}

export function snapshotScript(repos: readonly string[]): string {
  const list = repos.map(shq).join(" ");
  return `
H="$HOME"
echo "@@LOAD $(cut -d' ' -f1 /proc/loadavg 2>/dev/null)"
echo "@@CORES $(nproc 2>/dev/null)"
free -m 2>/dev/null | awk '/^Mem:/{print "@@MEM",$2,$3}'
df -k / 2>/dev/null | awk 'NR==2{print "@@DISK",$2,$3}'
echo "@@UPTIME $(cut -d. -f1 /proc/uptime 2>/dev/null)"
echo "@@CLAUDE $( (command -v claude >/dev/null 2>&1 || [ -x "$H/.local/bin/claude" ] || ls "$H"/.nvm/versions/node/*/bin/claude >/dev/null 2>&1) && echo yes || echo no)"
echo "@@GIT $(git --version 2>/dev/null | cut -d' ' -f3)"
for r in ${list} "$H"/Developer/.vmc/*.git; do
  case "$r" in "~/"*) r="$H/\${r#\\~/}";; esac
  [ -e "$r/.git" ] || [ -d "$r/objects" ] || continue
  echo "@@REPO $r"
  git -C "$r" worktree list --porcelain 2>/dev/null
  echo "@@ENDREPO"
  git -C "$r" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | while IFS= read -r wt; do
    [ -d "$wt" ] || continue
    echo "@@WT $wt"
    git -C "$wt" status --porcelain=v2 --branch 2>/dev/null
    echo "@@TS $(git -C "$wt" log -1 --format=%ct 2>/dev/null)"
    [ -f "$wt/.env" ] && echo "@@ENV"
    enc=$(printf '%s' "$wt" | sed 's/[^a-zA-Z0-9]/-/g')
    d="$H/.claude/projects/$enc"
    if [ -d "$d" ]; then
      for f in "$d"/*.jsonl; do
        [ -f "$f" ] || continue
        id=$(basename "$f" .jsonl)
        m=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null)
        n=$(wc -l < "$f" | tr -d ' ')
        echo "@@S $id $m $n"
        grep -m5 '"type":"user"' "$f" 2>/dev/null | cut -c1-4000
        echo "@@ENDS"
      done
    fi
    echo "@@ENDWT"
  done
done
`;
}

function parseHealth(lines: readonly string[]): VmHealthReading | null {
  const field = (name: string) => lines.find((line) => line.startsWith(`@@${name} `))?.slice(name.length + 3).trim() ?? "";
  const cores = Number(field("CORES"));
  const load = Number(field("LOAD"));
  const mem = field("MEM").split(" ").map(Number);
  const disk = field("DISK").split(" ").map(Number);
  if (!Number.isFinite(cores) || cores < 1 || !Number.isFinite(load) || mem.length < 2 || disk.length < 2) return null;
  const [memTotal = 0, memUsed = 0] = mem;
  const [diskTotal = 0, diskUsed = 0] = disk;
  return {
    cpu: Math.min(100, Math.round((load / cores) * 100)),
    cores,
    memUsedGb: Math.round((memUsed / 1024) * 10) / 10,
    memTotalGb: Math.round(memTotal / 1024),
    diskUsedGb: Math.round(diskUsed / 1024 / 1024),
    diskTotalGb: Math.round(diskTotal / 1024 / 1024),
    uptimeSeconds: Number(field("UPTIME")) || 0,
    claudeInstalled: field("CLAUDE") === "yes",
    gitVersion: field("GIT") || null,
  };
}

function section(lines: readonly string[], start: number, endMarker: string): { body: string[]; next: number } {
  const body: string[] = [];
  let index = start;
  while (index < lines.length && lines[index] !== endMarker) {
    body.push(lines[index] ?? "");
    index += 1;
  }
  return { body, next: index + 1 };
}

export function parseSnapshot(output: string): VmSnapshotData {
  const lines = output.split("\n");
  const health = parseHealth(lines);
  const repoBlocks = new Map<string, string>();
  const details = new Map<string, { status: ReturnType<typeof parseStatus>; ts: number; env: boolean; sessions: Worktree["sessions"] }>();

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.startsWith("@@REPO ")) {
      const repo = line.slice("@@REPO ".length);
      const block = section(lines, index + 1, "@@ENDREPO");
      repoBlocks.set(repo, block.body.join("\n"));
      index = block.next;
    } else if (line.startsWith("@@WT ")) {
      const path = line.slice("@@WT ".length);
      const block = section(lines, index + 1, "@@ENDWT");
      const sessions: Worktree["sessions"] = [];
      const statusLines: string[] = [];
      let ts = 0;
      let env = false;
      for (let i = 0; i < block.body.length; i += 1) {
        const entry = block.body[i] ?? "";
        if (entry.startsWith("@@TS ")) ts = Number(entry.slice(5)) || 0;
        else if (entry === "@@ENV") env = true;
        else if (entry.startsWith("@@S ")) {
          const [id = "", mtime = "0", count = "0"] = entry.slice(4).split(" ");
          const sample = section(block.body, i + 1, "@@ENDS");
          i = sample.next - 1;
          const title = titleFromTranscript(sample.body.join("\n"));
          if (Number(count) > 1) sessions.push({ id, title, messages: Number(count), lastActive: Number(mtime) || 0 });
        } else statusLines.push(entry);
      }
      details.set(path, { status: parseStatus(statusLines.join("\n")), ts, env, sessions: sessions.sort((a, b) => b.lastActive - a.lastActive) });
      index = block.next;
    } else {
      index += 1;
    }
  }

  const worktrees: Worktree[] = [];
  for (const [repo, text] of repoBlocks) {
    for (const [position, raw] of parseWorktreeList(text).entries()) {
      const detail = details.get(raw.path);
      if (raw.bare || raw.prunable || !detail) continue;
      worktrees.push({
        id: `vm:${raw.path}`,
        name: raw.path.split("/").pop() ?? raw.path,
        repo: (repo.split("/").pop() ?? repo).replace(/\.git$/, ""),
        branch: raw.branch,
        head: raw.head,
        location: "vm",
        path: raw.path,
        modified: detail.status.modified,
        ahead: detail.status.ahead,
        behind: detail.status.behind,
        lastActive: Math.max(detail.ts, detail.sessions[0]?.lastActive ?? 0),
        sessions: detail.sessions,
        hasEnv: detail.env,
        isMain: position === 0 && !raw.bare,
        merged: false,
        upstreamGone: false,
      });
    }
  }
  return { health, worktrees };
}

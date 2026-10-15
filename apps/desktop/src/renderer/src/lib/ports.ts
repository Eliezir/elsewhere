export function projectFor(cwd: string | null, paths: readonly string[]): string | null {
  if (cwd === null) return null;
  let best: string | null = null;
  for (const path of paths) {
    if ((cwd === path || cwd.startsWith(`${path}/`)) && (best === null || path.length > best.length)) best = path;
  }
  return best;
}

export function shortPath(path: string, home = "/home/dev"): string {
  return path === home ? "~" : path.startsWith(`${home}/`) ? `~/${path.slice(home.length + 1)}` : path;
}

export function labelFor(cwd: string | null, trees: readonly { path: string; repo: string; name: string }[]): string | null {
  const path = projectFor(cwd, trees.map((tree) => tree.path));
  const tree = trees.find((item) => item.path === path);
  if (tree) return `${tree.repo} · ${tree.name}`;
  const match = cwd === null ? null : /\/worktrees\/([^/]+)\/([^/]+)/.exec(cwd);
  return match?.[1] && match[2] ? `${match[1]} · ${match[2]}` : null;
}

export function serviceLabel(port: number, process: string): string {
  return port === 3773 ? "T3 Code server" : process.replace(/-MainThread$/, "");
}

export interface PortGroup<P> {
  key: string;
  repo: string;
  name: string;
  branch: string | null;
  root: string | null;
  ports: P[];
}

export function groupPorts<P extends { cwd: string | null; branch: string | null }>(ports: readonly P[], trees: readonly { path: string; repo: string; name: string }[]): PortGroup<P>[] {
  const groups = new Map<string, PortGroup<P>>();
  for (const port of ports) {
    const treePath = projectFor(port.cwd, trees.map((tree) => tree.path));
    const tree = trees.find((item) => item.path === treePath);
    const match = port.cwd === null ? null : /^(.*\/worktrees\/([^/]+)\/([^/]+))/.exec(port.cwd);
    const root = tree?.path ?? match?.[1] ?? port.cwd;
    const repo = tree?.repo ?? match?.[2] ?? "other";
    const name = tree?.name ?? match?.[3] ?? (root ? (root.split("/").pop() ?? repo) : repo);
    const key = root ?? `unknown:${port.cwd ?? ""}`;
    const group = groups.get(key) ?? { key, repo, name, branch: port.branch, root, ports: [] };
    group.ports.push(port);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function relativeTo(cwd: string | null, root: string | null): string | null {
  if (cwd === null || root === null || cwd === root) return null;
  return cwd.startsWith(`${root}/`) ? cwd.slice(root.length + 1) : null;
}

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

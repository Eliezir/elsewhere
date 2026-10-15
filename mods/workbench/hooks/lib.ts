export type PortRow = {
  port: number
  pid: number
  command: string
  cwd: string | null
  branch: string | null
}

export const LIST_SCRIPT = `
if [ "$(uname)" = Linux ]; then
  ss -ltnpH 2>/dev/null | while read -r _ _ _ local _ users; do
    port=\${local##*:}
    pid=$(printf %s "$users" | sed -n 's/.*pid=\\([0-9]*\\).*/\\1/p')
    [ -n "$pid" ] || continue
    cmd=$(printf %s "$users" | sed -n 's/.*(("\\([^"]*\\)".*/\\1/p')
    cwd=$(readlink /proc/$pid/cwd 2>/dev/null)
    branch=""
    [ -n "$cwd" ] && branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)
    echo "$port|$pid|$cmd|$cwd|$branch"
  done
else
  lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {n=split($9,a,":"); print a[n] "|" $2 "|" $1}' | sort -u | while IFS='|' read -r port pid cmd; do
    cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
    branch=""
    [ -n "$cwd" ] && branch=$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)
    echo "$port|$pid|$cmd|$cwd|$branch"
  done
fi
`

export function parsePorts(output: string): PortRow[] {
  const rows = new Map<number, PortRow>()
  for (const line of output.split('\n')) {
    const [port, pid, command, cwd, branch] = line.trim().split('|')
    const portNumber = Number(port)
    const pidNumber = Number(pid)
    if (!Number.isInteger(portNumber) || portNumber < 1 || !Number.isInteger(pidNumber) || pidNumber < 2 || !command) continue
    if (portNumber === 22) continue
    if (!rows.has(portNumber)) {
      rows.set(portNumber, { port: portNumber, pid: pidNumber, command, cwd: cwd || null, branch: branch || null })
    }
  }
  return [...rows.values()].sort((a, b) => a.port - b.port)
}

export function insideRoot(cwd: string | null, root: string): boolean {
  if (cwd === null) return false
  return cwd === root || cwd.startsWith(root.endsWith('/') ? root : `${root}/`)
}

export function statusText(rows: readonly PortRow[]): string | undefined {
  if (rows.length === 0) return undefined
  const first = rows[0]
  const ports = rows.map(row => `:${row.port}`).join(' ')
  return first?.branch ? `${first.branch} · ${ports}` : ports
}

export function relative(cwd: string | null, root: string): string {
  if (cwd === null) return ''
  if (cwd === root) return '.'
  return cwd.startsWith(`${root}/`) ? cwd.slice(root.length + 1) : cwd
}

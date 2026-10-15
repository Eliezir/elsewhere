# Elsewhere

Work on a remote dev VM as if it were next to you. Elsewhere shows the VM's health, lists your worktrees on the Mac and the VM, moves a project (branch, uncommitted work and its Claude sessions) in either direction, tracks your Claude usage, and drives Tailscale. It runs as a window plus a menu-bar popover. See `docs/BRIEF.md` for goals, features and phases.

## Layout

- `apps/desktop`: Electron app (electron-vite, React, Tailwind v4, Base UI, Motion, TanStack Query)
- `apps/daemon`: small Node service that runs on the VM (tailnet-only, token auth)
- `packages/shared`: Zod schemas and the IPC contract shared by both

## Commands

```bash
pnpm install
pnpm dev          # Electron app in dev mode
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Render the popover to a PNG without clicking the tray:

```bash
pnpm --filter @vmc/desktop build
cd apps/desktop && VMC_DEBUG_SCREENSHOT=/tmp/popover.png pnpm exec electron .
```

<p align="center">
  <img src="docs/icon.png" alt="Elsewhere app icon" width="112" />
</p>

<p align="center">
  <img src="docs/banner.png" alt="Elsewhere: work on a remote dev VM as if it were next to you" />
</p>

<p align="center">
  <a href="https://github.com/Eliezir/elsewhere/releases/latest">Download</a> ·
  <a href="https://eliezir.github.io/elsewhere/">Website</a> ·
  <a href="https://github.com/Eliezir/elsewhere/releases">Releases</a>
</p>

# Elsewhere

Work on a remote dev VM as if it were next to you. Elsewhere shows the VM's health, lists your worktrees on the Mac and the VM, moves a project (branch, uncommitted work and its Claude sessions) in either direction, tracks your Claude usage, and drives Tailscale. It runs as a window plus a menu-bar popover. See `docs/BRIEF.md` for goals, features and phases.

## Install

**macOS:** download the latest `.dmg` from the [releases page](https://github.com/Eliezir/elsewhere/releases). The build is not signed yet, so on first launch right-click the app and choose Open (or run `xattr -dr com.apple.quarantine /Applications/Elsewhere.app`).

**Windows (preview):** download the `.exe` installer from the same page. It is unsigned, so SmartScreen shows a warning: choose More info, then Run anyway. VM health, ports and forwarding, storage, Tailscale and Claude usage are the parts built for Windows. Send and bring back, and the Conductor and T3 Code shortcuts, are macOS only for now. It needs the OpenSSH client (included with Windows 10 and 11). Then open Settings and enter your VM's Tailscale host name and user.

## What it does

- VM health, Tailscale state and Claude usage (5-hour and weekly) at a glance
- Worktrees on the Mac and the VM, with where each one came from (Conductor, T3 Code, Claude agent, manual)
- Send a project to the VM and bring it back: branch, uncommitted work and Claude sessions
- Running ports on the VM with automatic forwarding to this Mac
- Storage by project and by folder on the VM
- One-click terminals, and Open in Conductor or T3 Code

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
pnpm --filter @vmc/desktop package       # macOS .dmg and .zip in apps/desktop/release
pnpm --filter @vmc/desktop package:win   # Windows installer (run on Windows)
```

Render the popover to a PNG without clicking the tray:

```bash
pnpm --filter @vmc/desktop build
cd apps/desktop && VMC_DEBUG_SCREENSHOT=/tmp/popover.png pnpm exec electron .
```

## Releases

Push a tag such as `v0.1.0` and the Release workflow builds the macOS and Windows apps and attaches the `.dmg`, `.zip` and `.exe` files to a GitHub release.

## License

MIT

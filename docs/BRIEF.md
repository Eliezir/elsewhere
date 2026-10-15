# Elsewhere: Electron app for working on a remote dev VM

Status: feature list agreed in discussion 2026-10-14; nothing built yet. Start in a FRESH session; read this file plus the memory note `oracle-remote-dev-vm`.

## Context
- VM `adt-dev`: Oracle A1.Flex, 2 OCPU / 12 GB, Ubuntu 24.04 aarch64, reachable ONLY over Tailscale: `ssh dev@<vm>.<tailnet>.ts.net`. Repo at ~/Developer/adt-studio. No GitHub credentials on the VM (public repo cloned over HTTPS).
- Mac: MacBook Air M4, 16 GB. Tailscale app CLI: /Applications/Tailscale.app/Contents/MacOS/Tailscale (status --json).
- Existing related project: ~/Developer/claude-companion (Swift menu-bar app, SwiftPM, no Xcode). Decide: separate Electron app vs. extending it.
- Guards on the Oracle account: budget `free-tier-guard` (1, alert at 1%), quota policy `free-tier-compute-only`. Oracle reclaims an A1 instance idle for 7 days (CPU, network and memory all <20%), so idle time is a real risk.

## Architecture (agreed direction)
- Electron app on the Mac = UI/client (menu-bar tray + popover; optional full window; launch at login; native notifications).
- Small daemon on the VM (Node, binds to the Tailscale interface only, token auth) = source of truth for jobs, queue, metrics, sync state. Keeps working when the Mac sleeps.
- Mac app talks to the VM over SSH and/or the daemon HTTP API on the tailnet. No public ports.
- Real macOS widgets are NOT possible from Electron alone (needs a SwiftUI WidgetKit extension fed by a JSON file in an App Group). Deferred; menu-bar popover first.

## Features
### A. Shell
A1 menu-bar icon with status colour (ok / warn / down); A2 popover with tabs; A3 optional full window; A4 start at login; A5 native notifications with per-alert toggles; A6 settings (VM host, intervals, thresholds); A7 light/dark.

### B. Connection and VM health
B1 Tailscale state from the local CLI (connected, device list, VM online, latency);
B2 VM metrics: CPU, load, memory, swap, disk, uptime;
B3 running jobs: tsc / vitest / vite / agents grouped by worktree, with kill;
B4 idle-reclaim gauge: 7-day CPU, network and memory vs the 20% threshold, warn before Oracle reclaims it;
B5 Oracle guard panel: budget spend, quota policy present, instance state (OCI CLI; session token expires, handle re-auth gracefully);
B6 alerts: VM unreachable, disk >80%, idle risk, spend alert seen, Tailscale disconnected.

### C. Projects and worktrees
C1 list worktrees on Mac (git worktree list, Conductor, T3) and on the VM; badge showing where each one lives;
C2 branch, dirty state, ahead/behind;
C3 open in terminal / editor / T3 Code;
C4 create or remove a worktree on the VM.

### D. Move / sync (Mac <-> VM)
D1 move a worktree to VM or back: WIP commit if dirty, push branch over SSH using the other machine as a git remote (no GitHub), create worktree on the target;
D2 copy Claude Code sessions: ~/.claude/projects/<path-encoded cwd>/*.jsonl, rewriting the encoded path for the target machine, plus the matching memory dir; verify `claude --resume` lists them;
D3 Conductor and T3 chats flagged non-portable unless proven otherwise;
D4 ownership marker ("this worktree lives on: VM"), refuse to move if both sides changed (conflict check);
D5 dry-run preview of exactly what will be copied; secrets (.env) and big data (books/) strictly opt-in;
D6 undo/rollback of a move.

### E. Claude usage and pacing
E1 show 5-hour and weekly limits, reset timers, per-model weekly (source to be proven; the desktop-app tool `get_usage` returns these, unclear for external processes);
E2 forecast: projected unused weekly capacity at reset;
E3 alerts: "weekly resets in N hours with X% unused".

### F. Task queue and scheduler (runs on the VM daemon)
F1 queue of tasks: prompt/spec, repo+worktree+branch, size estimate, priority, allowed window;
F2 pacer: release tasks only when headroom exists (use-it-or-lose-it near the weekly reset; stop below the 5-hour limit, e.g. 80%);
F3 safe execution: dedicated worktree and branch, no push, no PR, no credentials on the VM, explicit permission mode, timeouts;
F4 results as local commits plus a summary report; morning digest notification;
F5 live logs, pause, cancel, retry; history.

### G. Remote dev helpers
G1 start/stop dev servers on the VM bound to the tailnet (`--host`), open in the Mac browser over Tailscale;
G2 port list; G3 quick "run only affected tests" and "one heavy job at a time" guard (2 cores);
G4 boot-volume backup reminder/trigger.

### H. Security
H1 no secrets in plain files (Keychain for tokens); H2 daemon token + tailnet-only bind; H3 SSH via ssh-agent/keys; H4 audit log of every remote action the app takes.

## Spikes to run FIRST (unknowns that can change the design)
1. Can Claude plan usage (5h, weekly) be read from outside the desktop app (CLI, statusline, API)?
2. Does a copied Claude Code session resume correctly on the VM after path rewrite?
3. Can Claude Code run headless on the VM (login method for a Team plan, allowed for unattended runs)?
4. Where does T3 Code keep thread data, and is it portable to a T3 server on the VM?
5. Does Studio's API base URL / CORS allow remote dev-server access over Tailscale?

## Phases
- Phase 0: spikes 1-5.
- Phase 1 (MVP): A + B + C1/C2 (see the VM and worktrees at a glance).
- Phase 2: D (move/sync).
- Phase 3: E + F (usage-aware queue; daemon on VM).
- Later: G, SwiftUI widget fed by JSON, T3/Conductor integration.

## Open decisions
- Separate repo name/location (suggest ~/Developer/vm-companion, outside ADT Studio).
- Electron (TS/React) vs extending Claude Companion (Swift).
- Stack details: electron-vite + React + TS; ssh via spawn(`ssh`) first (fewer deps); SQLite only if needed.

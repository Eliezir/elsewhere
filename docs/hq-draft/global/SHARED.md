# Shared rules for every agent on every machine

Source of truth: ~/hq/global/SHARED.md, copied by fleet.py. Edit it there only.

## Machines
- Mac: editing and review. Low disk, keep worktrees few.
- WSL PC (adt-pc): heavy work, dev servers, builds, long agent runs.

## Task boards
- Each task has a folder `.context/<TASK-KEY>/` in the worktree you are working in. Use the issue or Jira key, like `issue-705` or `ABC-123`.
- Keep `.context/<TASK-KEY>/TASKS.md` current as you work: a `# Title`, then `## Now`, `## Next` and `## Notes`, with `- [ ]` and `- [x]` items.
- Only write to the folder of your own worktree. Never edit another worktree's folder.
- After a UI change, save a screenshot under `.context/<TASK-KEY>/shots/` and mention it in `TASKS.md`.
- `.context/` is not committed.

## Safety
- Do not push, open pull requests or merge without asking.
- Do not delete worktrees or branches without asking.

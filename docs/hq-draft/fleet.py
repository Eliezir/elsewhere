#!/usr/bin/env python3
import json, os, subprocess, sys
from pathlib import Path

HQ = Path(__file__).resolve().parent
CONFIG = json.loads((HQ / "fleet.json").read_text())
DRY = "--dry-run" in sys.argv
ROOT = os.environ.get("FLEET_HOME")


def home(machine):
    value = CONFIG["machines"][machine]["home"]
    return ROOT if ROOT and machine == "mac" else value


def target(machine, rel):
    ssh = CONFIG["machines"][machine]["ssh"]
    base = home(machine).rstrip("/")
    path = f"{base}/{rel}"
    return (f"{ssh}:{path}" if ssh else os.path.expanduser(path)), ssh


def rsync(src, dst, excludes=()):
    args = ["rsync", "-a", "--itemize-changes", "--backup", "--backup-dir=.fleet-backup"]
    args += [f"--exclude={e}" for e in excludes]
    if DRY:
        args.append("--dry-run")
    result = subprocess.run(args + [str(src), dst], capture_output=True, text=True)
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    return result.returncode, lines


def sync():
    status = 0
    for src, spec in CONFIG["files"].items():
        for machine in spec["to"]:
            dst, ssh = target(machine, spec["dest"])
            if not ssh:
                Path(dst).parent.mkdir(parents=True, exist_ok=True) if not DRY else None
            code, lines = rsync(HQ / src, dst)
            print(f"{'would update' if DRY else 'updated'} {machine}:{spec['dest']} {'(no change)' if not lines else ''}")
            status |= code
    skills = CONFIG["skills"]
    for machine in skills["to"]:
        dst, ssh = target(machine, skills["dest"] + "/")
        if not ssh and not DRY:
            Path(dst).mkdir(parents=True, exist_ok=True)
        code, lines = rsync(str(HQ / "skills") + "/", dst, skills["exclude"])
        print(f"{'would sync' if DRY else 'synced'} skills to {machine}: {len(lines)} changes")
        status |= code
    return status


def show_status():
    for machine in CONFIG["machines"]:
        for src, spec in CONFIG["files"].items():
            if machine not in spec["to"]:
                continue
            dst, ssh = target(machine, spec["dest"])
            cmd = ["ssh", ssh, f"cmp -s {dst.split(':', 1)[1]} - && echo same || echo different"] if ssh else None
            if ssh:
                out = subprocess.run(cmd, input=(HQ / src).read_text(), capture_output=True, text=True).stdout.strip() or "unreachable"
            else:
                path = Path(dst)
                out = "missing" if not path.exists() else ("same" if path.read_text() == (HQ / src).read_text() else "different")
            print(f"{machine:4} {spec['dest']:24} {out}")


if __name__ == "__main__":
    command = next((a for a in sys.argv[1:] if not a.startswith("--")), "status")
    sys.exit(sync() if command == "sync" else show_status() or 0)

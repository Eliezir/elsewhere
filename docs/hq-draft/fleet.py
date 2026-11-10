#!/usr/bin/env python3
import json, os, shlex, subprocess, sys
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


def ensure_line(machine, rel, line):
    dst, ssh = target(machine, rel)
    if ssh:
        path = dst.split(":", 1)[1]
        have = subprocess.run(["ssh", ssh, f"grep -qxF {shlex.quote(line)} {path}"]).returncode == 0
    else:
        path = Path(dst)
        have = path.exists() and line in path.read_text().splitlines()
    if have:
        print(f"ok {machine}:{rel} already has the line")
        return 0
    if DRY:
        print(f"would append to {machine}:{rel}: {line}")
        return 0
    if ssh:
        return subprocess.run(["ssh", ssh, f"mkdir -p $(dirname {path}) && printf '%s\\n' {shlex.quote(line)} >> {path}"]).returncode
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as handle:
        handle.write(line + "\n")
    print(f"appended to {machine}:{rel}")
    return 0


def make_remote_dir(machine, rel):
    dst, ssh = target(machine, rel)
    if ssh and not DRY:
        subprocess.run(["ssh", ssh, f"mkdir -p $(dirname {dst.split(':', 1)[1]})"])


def sync():
    status = 0
    for src, spec in CONFIG["files"].items():
        for machine in spec["to"]:
            dst, ssh = target(machine, spec["dest"])
            if not ssh and not DRY:
                Path(dst).parent.mkdir(parents=True, exist_ok=True)
            make_remote_dir(machine, spec["dest"])
            code, lines = rsync(HQ / src, dst)
            note = "(folder will be created)" if code else ("(no change)" if not lines else "")
            print(f"{'would update' if DRY else 'updated'} {machine}:{spec['dest']} {note}")
            status |= code
    for item in CONFIG.get("lines", []):
        for machine in item["to"]:
            status |= ensure_line(machine, item["file"], item["line"])
    skills = CONFIG["skills"]
    for machine in skills["to"]:
        dst, ssh = target(machine, skills["dest"] + "/")
        if not ssh and not DRY:
            Path(dst).mkdir(parents=True, exist_ok=True)
        make_remote_dir(machine, skills["dest"] + "/x")
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

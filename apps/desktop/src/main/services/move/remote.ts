import type { VmTarget } from "@vmc/shared";
import { runLocal, runSsh, shq, sshBaseArgs, type SshResult } from "../ssh";

function entryArg(entry: string): string {
  return entry === "." ? "." : `./${entry}`;
}

export interface Remote {
  home(): Promise<string>;
  run(script: string): Promise<SshResult>;
  url(path: string): string;
  gitEnv: Record<string, string>;
  upload(localParent: string, entry: string, remoteDir: string): Promise<SshResult>;
  download(remoteParent: string, entry: string, localDir: string): Promise<SshResult>;
}

export function sshRemote(target: VmTarget): Remote {
  const ssh = ["ssh", ...sshBaseArgs(target)].map(shq).join(" ");
  return {
    async home() {
      const result = await runSsh(target, 'printf %s "$HOME"', { timeout: 15000 });
      return result.code === 0 ? result.stdout.trim() : "";
    },
    run: (script) => runSsh(target, script, { timeout: 10 * 60 * 1000 }),
    url: (path) => `ssh://${target.user}@${target.host}${path}`,
    gitEnv: { GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=8", GIT_TERMINAL_PROMPT: "0" },
    upload: (localParent, entry, remoteDir) =>
      runLocal("sh", ["-c", `tar -C ${shq(localParent)} -cf - ${shq(entryArg(entry))} | ${ssh} ${shq(`mkdir -p ${shq(remoteDir)} && tar -C ${shq(remoteDir)} -xf - --keep-newer-files`)}`], {
        timeout: 30 * 60 * 1000,
      }),
    download: (remoteParent, entry, localDir) =>
      runLocal("sh", ["-c", `${ssh} ${shq(`tar -C ${shq(remoteParent)} -cf - ${shq(entryArg(entry))}`)} | tar -C ${shq(localDir)} -xf -`], { timeout: 30 * 60 * 1000 }),
  };
}

export function localRemote(home: string): Remote {
  return {
    home: async () => home,
    run: (script) => runLocal("sh", ["-s"], { input: script, timeout: 60000 }).then((result) => result),
    url: (path) => path,
    gitEnv: { GIT_TERMINAL_PROMPT: "0" },
    upload: (localParent, entry, remoteDir) =>
      runLocal("sh", ["-c", `mkdir -p ${shq(remoteDir)} && tar -C ${shq(localParent)} -cf - ${shq(entryArg(entry))} | tar -C ${shq(remoteDir)} -xf - --keep-newer-files 2>&1 || true`], { timeout: 60000 }),
    download: (remoteParent, entry, localDir) =>
      runLocal("sh", ["-c", `tar -C ${shq(remoteParent)} -cf - ${shq(entryArg(entry))} | tar -C ${shq(localDir)} -xf -`], { timeout: 60000 }),
  };
}

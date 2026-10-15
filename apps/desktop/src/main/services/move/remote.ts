import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VmTarget } from "@vmc/shared";
import { runLocal, runSsh, shq, sshBaseArgs, type SshResult } from "../ssh";

function entryArg(entry: string): string {
  return entry === "." ? "." : `./${entry}`;
}

const MAC_TAR = "COPYFILE_DISABLE=1 tar --no-xattrs";

async function withListFile<T>(files: readonly string[], work: (listFile: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "vmc-tar-"));
  try {
    const listFile = join(dir, "files.txt");
    await writeFile(listFile, `${files.map((file) => `./${file}`).join("\n")}\n`);
    return await work(listFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface Remote {
  home(): Promise<string>;
  run(script: string): Promise<SshResult>;
  url(path: string): string;
  gitEnv: Record<string, string>;
  upload(localParent: string, files: readonly string[], remoteDir: string): Promise<SshResult>;
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
    upload: (localParent, files, remoteDir) =>
      withListFile(files, (listFile) =>
        runLocal("sh", ["-c", `${MAC_TAR} -C ${shq(localParent)} -cf - -T ${shq(listFile)} | ${ssh} ${shq(`mkdir -p ${shq(remoteDir)} && tar -C ${shq(remoteDir)} -xf - --keep-newer-files`)}`], {
          timeout: 30 * 60 * 1000,
        }),
      ),
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
    upload: (localParent, files, remoteDir) =>
      withListFile(files, (listFile) =>
        runLocal("sh", ["-c", `mkdir -p ${shq(remoteDir)} && ${MAC_TAR} -C ${shq(localParent)} -cf - -T ${shq(listFile)} | tar -C ${shq(remoteDir)} -xf - --keep-newer-files`], { timeout: 60000 }),
      ),
    download: (remoteParent, entry, localDir) =>
      runLocal("sh", ["-c", `tar -C ${shq(remoteParent)} -cf - ${shq(entryArg(entry))} | tar -C ${shq(localDir)} -xf -`], { timeout: 60000 }),
  };
}

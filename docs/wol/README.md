# Wake-on-LAN for the WSL PC

Nothing here has been run. Do it in this order, once, when you are at the PC.

PC facts found earlier: adapter `Ethernet 2` (Realtek 2.5GbE), MAC shown by `Get-NetAdapter`, Fast Startup was on, S3 standby is available.

## 1. Windows

1. Open PowerShell as administrator.
2. Look first, change nothing: `powershell -ExecutionPolicy Bypass -File enable-wol.ps1`
3. If the numbers look right: `powershell -ExecutionPolicy Bypass -File enable-wol.ps1 -Apply`

The script turns on magic-packet wake (no pattern wake, so random traffic can't wake it), turns off the energy-saving Ethernet modes, and turns off Fast Startup. It leaves hibernation itself alone.

## 2. BIOS

- Enable Wake on LAN (often "PCI-E wake" or "Power on by PCI-E").
- Turn off ErP / EuP Ready. It cuts power to the network card when the PC is off.

## 3. Elsewhere

Settings → Connection → host "WSL PC" → paste the MAC address of that adapter, written with colons. The Wake button and the shut-down-when-idle toggle then both work.

## 4. Test, in this order

1. Shut the PC down from Windows.
2. From the Mac, on the same home network, press Wake. It should come up in about a minute.
3. Then test sleep if you prefer it: wake from sleep needs the same settings.

## Limits you should know

- A magic packet only travels inside your home network. Waking the PC from outside needs another always-on device at home (a Raspberry Pi, the router, or your Alexa skill).
- WSL does not start by itself after Windows boots until someone logs in or a task starts it. Two options: a scheduled task at startup running `wsl.exe -d Ubuntu --exec sleep infinity` (needs your Windows password stored for the task), or Windows auto-login. Pick one when you set this up.
- The PC's only Tailscale node lives in WSL, so until WSL is up there is no way in over the tailnet.

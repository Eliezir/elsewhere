import { stopAllForwards } from "./services/forwards";
import { startForwardLoop, stopForwardLoop } from "./services/forwardLoop";
import { getLinkStatus, linkTooltip, onLinkChange, trayIconName } from "./services/link";
import { getPrefs, hidesFromDock, keepsRunningInBackground, loadPrefs, onPrefsChange } from "./services/prefs";
import type { LinkState } from "@vmc/shared";
import { join } from "node:path";
import { app, BrowserWindow, Menu, nativeImage, nativeTheme, powerMonitor, Tray } from "electron";
import { IPC } from "@vmc/shared";
import { runScreenshotDebug } from "./debug";
import { registerIpc } from "./ipc";
import { refreshUsage } from "./services/usage";
import { createMainWindow, createPopover, togglePopover } from "./windows";

const USAGE_POLL_MS = 5 * 60 * 1000;

const userDataPath = app.getPath("userData");
app.setName("Elsewhere");
app.setPath("userData", userDataPath);

nativeTheme.themeSource = "dark";

const screenshotPath = process.env.VMC_DEBUG_SCREENSHOT;
const debugView = process.env.VMC_DEBUG_VIEW ?? "main";

let mainWindow: BrowserWindow | null = null;
let quitRequested = false;

function quitForReal(): void {
  quitRequested = true;
  app.quit();
}

function sendSection(window: BrowserWindow, section: string | undefined): void {
  if (section === undefined) return;
  const send = () => window.webContents.send(IPC.navigate, section);
  if (window.webContents.isLoading()) window.webContents.once("did-finish-load", send);
  else send();
}

function applyDock(): void {
  if (process.platform !== "darwin" || screenshotPath !== undefined) return;
  if (hidesFromDock(getPrefs())) {
    app.dock?.hide();
    return;
  }
  const windowOpen = mainWindow !== null && !mainWindow.isDestroyed() && mainWindow.isVisible();
  if (windowOpen || !keepsRunningInBackground(getPrefs())) void app.dock?.show();
  else app.dock?.hide();
}

function showMainWindow(section?: string): void {
  if (process.platform === "darwin" && screenshotPath === undefined && !hidesFromDock(getPrefs())) void app.dock?.show();
  if (mainWindow === null || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow(screenshotPath !== undefined);
    mainWindow.on("closed", () => {
      mainWindow = null;
      applyDock();
    });
    sendSection(mainWindow, section);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  sendSection(mainWindow, section);
}

function trayImage(state: LinkState): Electron.NativeImage {
  if (process.platform !== "darwin") return nativeImage.createFromPath(join(app.getAppPath(), "resources/icon.png")).resize({ width: 16, height: 16, quality: "best" });
  return nativeImage.createFromPath(join(app.getAppPath(), `resources/${trayIconName(state)}.png`));
}

let tray: Tray | null = null;

function syncTray(popover: BrowserWindow): void {
  const wanted = getPrefs().showInMenuBar || screenshotPath !== undefined;
  if (!wanted) {
    tray?.destroy();
    tray = null;
    return;
  }
  if (tray !== null) return;
  const created = new Tray(trayImage(getLinkStatus().state));
  created.setToolTip(linkTooltip(getLinkStatus()));
  created.on("click", () => togglePopover(popover, created.getBounds()));
  created.on("right-click", () =>
    created.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Elsewhere", click: () => showMainWindow() },
        { label: "Ports", click: () => showMainWindow("vm") },
        { type: "separator" },
        { label: "Quit Elsewhere", click: quitForReal },
      ]),
    ),
  );
  tray = created;
}

void app.whenReady().then(async () => {
  powerMonitor.on("shutdown", () => {
    quitRequested = true;
  });
  await loadPrefs();
  app.dock?.setIcon(nativeImage.createFromPath(join(app.getAppPath(), "resources/icon.png")));
  registerIpc({ openMainWindow: showMainWindow });
  startForwardLoop();
  if (screenshotPath === undefined) {
    void refreshUsage();
    setInterval(() => void refreshUsage(), USAGE_POLL_MS);
  }
  const popover = createPopover();
  syncTray(popover);
  onLinkChange((status) => {
    tray?.setImage(trayImage(status.state));
    tray?.setToolTip(linkTooltip(status));
  });
  onPrefsChange(() => {
    syncTray(popover);
    applyDock();
    if (hidesFromDock(getPrefs()) && mainWindow !== null && !mainWindow.isDestroyed() && mainWindow.isVisible()) mainWindow.show();
  });
  const debuggingPopover = screenshotPath !== undefined && debugView === "popover";
  if (debuggingPopover) popover.removeAllListeners("blur");
  else if (startedHidden()) applyDock();
  else showMainWindow();

  const target = debuggingPopover ? popover : mainWindow;
  if (screenshotPath && target) runScreenshotDebug(target, screenshotPath);
});

function startedHidden(): boolean {
  if (screenshotPath !== undefined || !keepsRunningInBackground(getPrefs())) return false;
  return process.argv.includes("--hidden") || (process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin);
}

app.on("activate", () => {
  if (mainWindow === null || mainWindow.isDestroyed() || !mainWindow.isVisible()) showMainWindow();
});
app.on("window-all-closed", () => undefined);
app.on("before-quit", (event) => {
  if (!quitRequested && screenshotPath === undefined && keepsRunningInBackground(getPrefs())) {
    event.preventDefault();
    if (mainWindow !== null && !mainWindow.isDestroyed()) mainWindow.close();
    applyDock();
    return;
  }
  stopForwardLoop();
  stopAllForwards();
});

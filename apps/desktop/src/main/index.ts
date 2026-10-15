import { stopAllForwards } from "./services/forwards";
import { startForwardLoop, stopForwardLoop } from "./services/forwardLoop";
import { join } from "node:path";
import { app, BrowserWindow, nativeImage, nativeTheme, Tray } from "electron";
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

function sendSection(window: BrowserWindow, section: string | undefined): void {
  if (section === undefined) return;
  const send = () => window.webContents.send(IPC.navigate, section);
  if (window.webContents.isLoading()) window.webContents.once("did-finish-load", send);
  else send();
}

function showMainWindow(section?: string): void {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow(screenshotPath !== undefined);
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
    sendSection(mainWindow, section);
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  sendSection(mainWindow, section);
}

void app.whenReady().then(() => {
  app.dock?.setIcon(nativeImage.createFromPath(join(app.getAppPath(), "resources/icon.png")));
  registerIpc({ openMainWindow: showMainWindow });
  startForwardLoop();
  if (screenshotPath === undefined) {
    void refreshUsage();
    setInterval(() => void refreshUsage(), USAGE_POLL_MS);
  }
  const popover = createPopover();
  const tray = new Tray(
    process.platform === "darwin"
      ? nativeImage.createFromPath(join(app.getAppPath(), "resources/trayTemplate.png"))
      : nativeImage.createFromPath(join(app.getAppPath(), "resources/icon.png")).resize({ width: 16, height: 16, quality: "best" }),
  );
  tray.setToolTip("Elsewhere");
  tray.on("click", () => togglePopover(popover, tray.getBounds()));
  const debuggingPopover = screenshotPath !== undefined && debugView === "popover";
  if (debuggingPopover) popover.removeAllListeners("blur");
  else showMainWindow();

  const target = debuggingPopover ? popover : mainWindow;
  if (screenshotPath && target) runScreenshotDebug(target, screenshotPath);
});

app.on("activate", () => showMainWindow());
app.on("window-all-closed", () => undefined);
app.on("before-quit", () => {
  stopForwardLoop();
  stopAllForwards();
});

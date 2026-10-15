import { join } from "node:path";
import { app, BrowserWindow, nativeImage, nativeTheme, Tray } from "electron";
import { IPC } from "@vmc/shared";
import { runScreenshotDebug } from "./debug";
import { registerIpc } from "./ipc";
import { createMainWindow, createPopover, togglePopover } from "./windows";

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
  const popover = createPopover();
  const tray = new Tray(nativeImage.createFromPath(join(app.getAppPath(), "resources/trayTemplate.png")));
  tray.setToolTip("VM Companion");
  tray.on("click", () => togglePopover(popover, tray.getBounds()));
  showMainWindow();

  if (screenshotPath && mainWindow) {
    runScreenshotDebug(debugView === "popover" ? popover : mainWindow, screenshotPath);
  }
});

app.on("activate", () => showMainWindow());
app.on("window-all-closed", () => undefined);

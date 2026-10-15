import { BrowserWindow, screen, type BrowserWindowConstructorOptions, type Rectangle } from "electron";
import { join } from "node:path";
import { MAIN_WINDOW_SIZE, POPOVER_SIZE } from "./config";

export type View = "main" | "popover";

const SHARED_PREFERENCES: BrowserWindowConstructorOptions["webPreferences"] = {
  preload: join(__dirname, "../preload/index.cjs"),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
};

function loadView(window: BrowserWindow, view: View): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  const hash = view === "popover" ? "/popover" : "/";
  const search = process.env.VMC_DEBUG_QUERY ?? "";
  if (devUrl) {
    void window.loadURL(`${devUrl}${search ? `?${search}` : ""}#${hash}`);
  } else {
    const query = Object.fromEntries(new URLSearchParams(search));
    void window.loadFile(join(__dirname, "../renderer/index.html"), { hash, query });
  }
}

export function createMainWindow(opaque: boolean): BrowserWindow {
  const window = new BrowserWindow({
    ...MAIN_WINDOW_SIZE,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: opaque ? "#14161a" : "#00000000",
    vibrancy: opaque ? undefined : "under-window",
    visualEffectState: "active",
    webPreferences: SHARED_PREFERENCES,
  });
  window.once("ready-to-show", () => window.show());
  loadView(window, "main");
  return window;
}

export function createPopover(): BrowserWindow {
  const popover = new BrowserWindow({
    ...POPOVER_SIZE,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    hasShadow: true,
    vibrancy: "popover",
    visualEffectState: "active",
    webPreferences: SHARED_PREFERENCES,
  });
  popover.on("blur", () => popover.hide());
  loadView(popover, "popover");
  return popover;
}

export function togglePopover(popover: BrowserWindow, trayBounds: Rectangle): void {
  if (popover.isVisible()) {
    popover.hide();
    return;
  }
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const { width } = popover.getBounds();
  const centered = Math.round(trayBounds.x + trayBounds.width / 2 - width / 2);
  const maxX = display.workArea.x + display.workArea.width - width - 8;
  const x = Math.max(display.workArea.x + 8, Math.min(centered, maxX));
  const y = trayBounds.y + trayBounds.height + 4;
  popover.setPosition(x, y, false);
  popover.show();
  popover.focus();
}

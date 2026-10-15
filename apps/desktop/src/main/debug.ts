import { app, type BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";

const SETTLE_MS = 6000;

export function runScreenshotDebug(window: BrowserWindow, outPath: string): void {
  window.webContents.on("preload-error", (_event, path, error) => {
    console.error(`preload-error ${path}: ${error.message}`);
  });
  window.webContents.on("console-message", (event) => {
    console.log(`renderer[${event.level}] ${event.message}`);
  });
  window.webContents.once("did-finish-load", () => {
    window.show();
    setTimeout(() => {
      const tab = JSON.stringify(process.env.VMC_DEBUG_TAB ?? "");
      void window.webContents
        .executeJavaScript(`[...document.querySelectorAll('[role=tab]')].find((t) => t.textContent === ${tab})?.click()`)
        .then(() => new Promise((resolve) => setTimeout(resolve, 2500)))
        .then(() => (process.env.VMC_DEBUG_EVAL ? window.webContents.executeJavaScript(process.env.VMC_DEBUG_EVAL) : undefined))
        .then(() => new Promise((resolve) => setTimeout(resolve, 400)))
        .then(() => window.webContents.executeJavaScript("document.querySelector('[role=tabpanel]')?.outerHTML.slice(0, 400) ?? 'no tabpanel'"))
        .then((html) => console.log(`panel: ${html}`))
        .then(() => window.webContents.capturePage())
        .then((image) => writeFile(outPath, image.toPNG()))
        .finally(() => app.quit());
    }, SETTLE_MS);
  });
}

/// <reference types="vite/client" />
import type { Api } from "@vmc/shared";

declare global {
  interface Window {
    api: Api;
  }
}

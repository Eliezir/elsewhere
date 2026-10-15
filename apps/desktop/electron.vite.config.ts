import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const bundleShared = externalizeDepsPlugin({ exclude: ["@vmc/shared"] });

export default defineConfig({
  main: { plugins: [bundleShared] },
  preload: {
    plugins: [bundleShared],
    build: {
      rollupOptions: { output: { format: "cjs", entryFileNames: "[name].cjs" } },
    },
  },
  renderer: {
    resolve: {
      alias: { "@": resolve("src/renderer/src") },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom/client",
        "motion/react",
        "@tanstack/react-query",
        "@base-ui/react/tabs",
        "@base-ui/react/separator", "@base-ui/react/accordion", "@base-ui/react/switch", "@base-ui/react/slider", "@base-ui/react/input", "@base-ui/react/toggle-group", "@base-ui/react/toggle",
      ],
    },
    plugins: [react(), tailwindcss()],
  },
});

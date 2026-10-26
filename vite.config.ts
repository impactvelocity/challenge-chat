import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: mode === "test" ? [react()] : [react(), cloudflare({ viteEnvironment: { name: "worker" } })],
  ...(mode === "test"
    ? {}
    : {
        environments: {
          worker: {
            build: { sourcemap: true },
          },
        },
      }),
}));

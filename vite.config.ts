import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: mode === "test" ? [react()] : [react(), tailwindcss(), cloudflare({ viteEnvironment: { name: "worker" } })],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
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

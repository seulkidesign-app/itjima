import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  envDir: root,
  plugins: [react()],
  server: { port: 5183, strictPort: true, fs: { allow: [root] } },
  preview: { port: 4183, strictPort: true },
  build: { outDir: "dist" },
});

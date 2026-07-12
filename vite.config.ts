import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    // autoCodeSplitting disabled: with only 3 core tabs, splitting each
    // into a separately-fetched chunk means a first-ever visit to a tab
    // while offline fails hard (browser-native offline error page) instead
    // of degrading gracefully. Bundling them together is a small size
    // tradeoff for tabs that always work offline.
    TanStackRouterVite({ autoCodeSplitting: false }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Main entry (~560 kB min) includes router + Supabase; warn only above 650 kB
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/]react/,
              priority: 20,
            },
            {
              name: "vendor-tanstack",
              test: /node_modules[\\/]@tanstack/,
              priority: 15,
            },
            {
              name: "vendor-supabase",
              test: /node_modules[\\/]@supabase/,
              priority: 15,
            },
          ],
        },
      },
    },
  },
});

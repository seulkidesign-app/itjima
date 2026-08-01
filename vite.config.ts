import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    // Route-level splitting stays disabled: the three core tabs must remain
    // available together after the application shell is cached. Large shared
    // libraries are still emitted as stable vendor chunks below.
    TanStackRouterVite({ autoCodeSplitting: false }),
    react(),
    tailwindcss(),
  ],
  test: {
    environment: "happy-dom",
    include: ["tests/**/*.test.ts"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-tanstack",
              test: /node_modules[\\/]@tanstack[\\/]/,
              priority: 25,
            },
            {
              name: "vendor-supabase",
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 25,
            },
            {
              name: "vendor-motion",
              test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/,
              priority: 20,
            },
            {
              name: "vendor-ui",
              test: /node_modules[\\/](@radix-ui|lucide-react|sonner|vaul|cmdk|embla-carousel-react)[\\/]/,
              priority: 15,
            },
            {
              name: "vendor-data",
              test: /node_modules[\\/](@hookform|date-fns|react-hook-form|zod)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});

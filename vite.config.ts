import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    metaImagesPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "@kora/api": path.resolve(import.meta.dirname, "packages", "api", "src", "index.ts"),
      "@kora/content": path.resolve(import.meta.dirname, "packages", "content", "src", "index.ts"),
      "@kora/tokens": path.resolve(import.meta.dirname, "packages", "tokens", "src", "index.ts"),
      "@kora/types": path.resolve(import.meta.dirname, "packages", "types", "src", "index.ts"),
      "@kora/utils": path.resolve(import.meta.dirname, "packages", "utils", "src", "index.ts"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        hoistTransitiveImports: false,
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts")) return "vendor-charts";
          if (id.includes("react-day-picker")) return "vendor-calendar";
          if (id.includes("@tanstack/react-query")) return "vendor-query";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("qrcode.react")) return "vendor-qr";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});

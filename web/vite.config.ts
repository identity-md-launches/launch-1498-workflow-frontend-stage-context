import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "runtime-deployment-for-development",
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const path = (request.url || "").split("?")[0];
          if (
            !/^\/(imd-deployment\.json|abi\/(Game|LaunchToken)\.json)$/.test(
              path,
            )
          )
            return next();
          try {
            const bytes = await readFile(
              fileURLToPath(new URL("../dist" + path, import.meta.url)),
            );
            response.setHeader("Content-Type", "application/json");
            response.end(bytes);
          } catch {
            response.statusCode = 503;
            response.end(
              "Build the verified export before starting development.",
            );
          }
        });
      },
    },
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: { manualChunks: { scene: ["three"], wallet: ["viem"] } },
    },
  },
});

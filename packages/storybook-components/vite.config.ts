import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      // Copy tokens.css to dist so consumers can import it directly.
      // index.css is emitted automatically by the tailwindcss vite plugin.
      name: "copy-tokens-css",
      closeBundle() {
        mkdirSync("dist", { recursive: true });
        copyFileSync(
          resolve(__dirname, "src/tokens.css"),
          resolve(__dirname, "dist/tokens.css")
        );
      },
    },
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "react-markdown"],
    },
  },
});

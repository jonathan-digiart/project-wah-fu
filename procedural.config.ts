import { defineConfig } from "vite";
import { copyFileSync } from "node:fs";
export default defineConfig({
  base: "./",
  publicDir: false,
  plugins: [
    {
      name: "procedural-notices",
      closeBundle() {
        for (const name of [
          "DATA-ATTRIBUTION.txt",
          "THREE-LICENSE.txt",
          "EARCUT-LICENSE.txt",
        ])
          copyFileSync(`public/${name}`, `dist-procedural/${name}`);
      },
    },
  ],
  build: {
    outDir: "dist-procedural",
    rollupOptions: { input: "procedural.html" },
  },
});

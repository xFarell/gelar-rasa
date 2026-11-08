import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Dua mode build:
//  - default  → dist/         : multi-file, code-splitting (Netlify, Vercel, GitHub Pages, server statis apa pun)
//  - single   → dist-single/  : satu file HTML mandiri (semua JS, CSS, font, dan data di-inline);
//                               routing hash "polos" (#spatial) untuk host yang hanya meneruskan #nama.
export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    base: "./",
    plugins: single ? [react(), viteSingleFile()] : [react()],
    build: single
      ? { target: "es2020", outDir: "dist-single", assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 10000 }
      : { target: "es2020", chunkSizeWarningLimit: 2000, rollupOptions: { output: { manualChunks: { react: ["react", "react-dom"], d3: ["d3"] } } } },
    test: { environment: "node" },
  };
});

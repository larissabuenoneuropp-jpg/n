// Compila o "Meu Financeiro" (app independente, sem servidor) reaproveitando o núcleo e as telas
// financeiras de ../src. As dependências do NeuroPlanner são trocadas por versões locais (src/shims).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r("."),
  base: "./",
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: r("./src/shims/link.tsx") },
      { find: /^next\/navigation$/, replacement: r("./src/shims/navigation.ts") },
      { find: /^@\/lib\/data\/provider$/, replacement: r("./src/shims/provider.tsx") },
      { find: /^@\/lib\/finance\/runtime$/, replacement: r("./src/shims/runtime.ts") },
      { find: /^@\//, replacement: r("../src/") },
    ],
    dedupe: ["react", "react-dom"],
  },
  build: {
    outDir: r("./dist"),
    emptyOutDir: true,
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 10_000,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});

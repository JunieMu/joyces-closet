import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Domain-only tests (Decision 11): no DOM needed — storage and RNG are injected.
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});

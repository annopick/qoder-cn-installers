import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/**/*.test.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
});

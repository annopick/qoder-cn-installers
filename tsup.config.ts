import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/**/*.test.ts"],
  format: ["esm"],
  platform: "node",
  target: "node18",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
});

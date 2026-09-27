import { build } from "esbuild";

await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  // Obsidian provides these at runtime. Bundling a second copy of the
  // CodeMirror packages breaks StateField and Decoration identity, so
  // extensions are silently ignored or rejected by the editor.
  external: [
    "obsidian",
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/language",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
  ],
  format: "cjs",
  platform: "browser",
  target: "es2020",
  outfile: "main.js",
  sourcemap: false,
  logLevel: "info",
});

import { build, context } from "esbuild";

const options = {
  entryPoints: ["src/plugin.ts"],
  outfile: "net.opland.fluxer.sdPlugin/bin/plugin.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  // ws is CommonJS and needs require() inside an ES module bundle.
  banner: { js: "import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);" },
};

if (process.argv.includes("--watch")) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching…");
} else {
  await build(options);
  console.log("built net.opland.fluxer.sdPlugin/bin/plugin.js");
}

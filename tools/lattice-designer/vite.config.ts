import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { scenarioApi } from "./scenario-api";

// The Lattice factory designer. A plain SPA dev tool: `vite build` emits a static
// bundle, but it is normally run with `vite dev` while authoring a factory. Only the
// dev server carries `scenarioApi`, which is what lets the tool open and save the
// lattice version's committed scenarios; a built bundle can still export/download.
//
// The renderer, the interpolation and the `lattice-core` wasm come from
// `@clockwyrks/lattice-runtime`; the sprite sheet is read from the lattice version
// beside this tool (see `src/assets.ts`). Both sit inside the test-suites checkout,
// the workspace root Vite serves files from, so no alias and no `fs.allow` entry is
// needed to reach them.
export default defineConfig({
  plugins: [react(), scenarioApi()],
  server: {
    port: 1431,
    strictPort: true,
  },
});

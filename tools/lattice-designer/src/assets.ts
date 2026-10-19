// The reused Lattice assets, imported once. The engine is
// `@clockwyrks/lattice-runtime`'s `lattice-core.wasm`; the sprite sheet is the
// lattice version's own atlas, read from the version beside this tool in the
// test-suites checkout (`replay/assets/sheet.{json,png}`), the content the console
// vendors for its run player. Keeping them behind one module means the sim and the
// grid share a single cell size and the same engine + sprite sheet a run's playback
// uses, so this designer draws pixel-identically to it.

import type { Atlas } from "@clockwyrks/lattice-runtime";
import wasmUrl from "@clockwyrks/lattice-runtime/lattice-core.wasm?url";
import atlasJson from "../../../test-cases/performance/hard/lattice/v1.0.0/replay/assets/sheet.json";
import sheetPngUrl from "../../../test-cases/performance/hard/lattice/v1.0.0/replay/assets/sheet.png?url";

/** The sprite atlas (entity + item frames), typed. */
export const atlas = atlasJson as unknown as Atlas;

/** Pixels per grid tile — the renderer's cell size, used for canvas sizing and
 * pointer-to-tile mapping. */
export const CELL = atlas.cellSize;

export { wasmUrl, sheetPngUrl };

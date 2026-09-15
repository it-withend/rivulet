// MapLibre 6 locates its web worker next to its own module URL. Bundled by
// Turbopack, that URL points into a chunk and the worker 404s, so GeoJSON
// layers never render. Serve the worker files from public/ instead.
import { copyFileSync, mkdirSync } from "node:fs";

const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync("public/maplibre", { recursive: true });
for (const file of FILES) {
  copyFileSync(`node_modules/maplibre-gl/dist/${file}`, `public/maplibre/${file}`);
}

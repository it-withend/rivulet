// Minimal WGS84 -> UTM forward projection (the standard closed-form series
// from USGS Professional Paper 1395 / Snyder 1987 — public-domain
// cartographic formulas, not a third-party library) plus small helpers for
// reading a pixel window out of a remote Cloud-Optimised GeoTIFF around a
// geographic point, and for sampling one already-read window at another
// point. Sentinel-2 L2A COGs are stored in their native UTM zone, not
// WGS84, so every water body centroid must be reprojected before it can be
// turned into a pixel index.
import type { GeoTIFFImage } from "geotiff";

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const UTM_K0 = 0.9996;

export function lonLatToUtm(
  lon: number,
  lat: number,
  zone: number,
): { easting: number; northing: number } {
  const e2 = WGS84_F * (2 - WGS84_F);
  const ep2 = e2 / (1 - e2);
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const lon0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;

  const N = WGS84_A / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = ep2 * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lon0);
  const M =
    WGS84_A *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * latRad -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * latRad) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * latRad));

  const easting =
    UTM_K0 *
      N *
      (A +
        ((1 - T + C) * A ** 3) / 6 +
        ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) +
    500_000;

  let northing =
    UTM_K0 *
    (M +
      N *
        Math.tan(latRad) *
        (A ** 2 / 2 +
          ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
          ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
  if (lat < 0) northing += 10_000_000;

  return { easting, northing };
}

/** EPSG 326xx = WGS84 UTM north zone xx; 327xx = south. Sentinel-2 only ever uses these. */
export function utmZoneFromEpsg(epsg: number): number {
  return epsg % 100;
}

export type BandWindow = {
  data: ArrayLike<number>;
  size: number;
  colMin: number;
  rowMin: number;
  bbox: [number, number, number, number];
  xRes: number;
  yRes: number;
};

/** Reads a small `size`x`size` pixel window centred on a UTM point, clamped to the raster edges. */
export async function readWindow(
  image: GeoTIFFImage,
  easting: number,
  northing: number,
  size: number,
): Promise<BandWindow> {
  const bbox = image.getBoundingBox() as [number, number, number, number];
  const width = image.getWidth();
  const height = image.getHeight();
  const xRes = (bbox[2] - bbox[0]) / width;
  const yRes = (bbox[3] - bbox[1]) / height;

  const col = (easting - bbox[0]) / xRes;
  const row = (bbox[3] - northing) / yRes;
  const half = Math.floor(size / 2);

  const colMin = Math.max(0, Math.min(width - size, Math.round(col) - half));
  const rowMin = Math.max(0, Math.min(height - size, Math.round(row) - half));

  const rasters = await image.readRasters({
    window: [colMin, rowMin, colMin + size, rowMin + size],
  });
  const data = (rasters as unknown as ArrayLike<number>[])[0];

  return { data, size, colMin, rowMin, bbox, xRes, yRes };
}

/** The value at a UTM point inside an already-read window, or null if the point falls outside it. */
export function sampleWindowAt(
  window: BandWindow,
  easting: number,
  northing: number,
): number | null {
  const col = Math.floor((easting - window.bbox[0]) / window.xRes) - window.colMin;
  const row = Math.floor((window.bbox[3] - northing) / window.yRes) - window.rowMin;
  if (col < 0 || col >= window.size || row < 0 || row >= window.size) return null;
  return Number(window.data[row * window.size + col]);
}

/** UTM coordinate of the centre of local pixel (col, row) inside `window`. */
export function pixelCentreUtm(
  window: BandWindow,
  localCol: number,
  localRow: number,
): { easting: number; northing: number } {
  const col = window.colMin + localCol;
  const row = window.rowMin + localRow;
  return {
    easting: window.bbox[0] + (col + 0.5) * window.xRes,
    northing: window.bbox[3] - (row + 0.5) * window.yRes,
  };
}

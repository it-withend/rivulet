import type { MetadataRoute } from "next";
import { CITIES } from "@/lib/cities";

const BASE = "https://rivulet-xi.vercel.app";
const STATIC_PAGES = ["", "/map", "/city", "/journal", "/leaderboard", "/open-data", "/method"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = STATIC_PAGES.map((path) => ({ url: `${BASE}${path}`, lastModified: now }));
  const cityPages = CITIES.flatMap((city) => [
    { url: `${BASE}/map?city=${city}`, lastModified: now },
    { url: `${BASE}/city?city=${city}`, lastModified: now },
  ]);
  return [...pages, ...cityPages];
}

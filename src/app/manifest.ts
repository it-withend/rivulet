import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rivulet — urban streams",
    short_name: "Rivulet",
    description:
      "Check an urban stream in two minutes and see how far to trust what residents report. Works with a poor connection.",
    start_url: "/",
    display: "standalone",
    background_color: "#eeede5",
    theme_color: "#185157",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Check a stream", url: "/observe" },
      { name: "Map", url: "/map" },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/moderate", "/api/moderation/"] },
    ],
    sitemap: "https://rivulet-xi.vercel.app/sitemap.xml",
  };
}

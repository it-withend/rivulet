import type { NextConfig } from "next";

// A conservative baseline (OWASP Secure Headers Project) for every response.
// The map needs OpenStreetMap tiles and an unpacked worker script; the CSP
// below is the narrowest set that still lets those load. Dev additionally
// needs 'unsafe-eval' and a websocket for Turbopack's fast refresh.
const dev = process.env.NODE_ENV !== "production";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' blob:${dev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org",
      "font-src 'self' data:",
      `connect-src 'self' https://tile.openstreetmap.org${dev ? " ws://localhost:* http://localhost:*" : ""}`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
] as const;

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [...SECURITY_HEADERS] }];
  },
};

export default nextConfig;

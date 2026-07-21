import type { NextConfig } from "next";

// Baseline security headers applied to every response. These are safe defaults
// for a public deployment on Vercel (HTTPS-only). A stricter Content-Security-
// Policy is intentionally omitted here because it needs per-app tuning against
// inline styles/scripts; add one once the allowed sources are pinned down.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

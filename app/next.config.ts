import type { NextConfig } from "next";

// Security response headers applied to every route.
// These harden the app against clickjacking, MIME sniffing, and protocol
// downgrade, and help corporate web filters classify the site as trusted.
const securityHeaders = [
  // Force HTTPS for two years, including subdomains. Safe because the site is
  // served over HTTPS by Netlify.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Disallow the app from being embedded in a frame (clickjacking protection).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from MIME-sniffing responses away from the declared type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Turn off powerful browser features the app doesn't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Belt-and-suspenders clickjacking protection via CSP frame-ancestors.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();
const typekit = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT ? "https://use.typekit.net https://p.typekit.net" : "";

// Content-Security-Policy: só carrega scripts/estilos/conexões do próprio site (e do Supabase, se configurado).
// 'unsafe-inline' em scripts é exigido pelo Next.js sem nonce; ainda assim bloqueia scripts de outros domínios.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  `style-src 'self' 'unsafe-inline' ${typekit}`.trim(),
  `font-src 'self' data: ${typekit}`.trim(),
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "media-src 'self' blob:",
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^https:/, "wss:")}`.replace(/\s+/g, " ").trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};

export default nextConfig;

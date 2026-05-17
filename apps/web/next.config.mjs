// SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
// SPDX-License-Identifier: EUPL-1.2

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Workspace packages ship as ESM source — Next must transpile them so
  // browser bundles work. shared-types is pure TS interfaces (no runtime
  // beyond Zod re-exports) and design-tokens is JS + CSS, but listing
  // both keeps the rule explicit for future packages.
  transpilePackages: ['@inventario/shared-types', '@inventario/design-tokens'],

  // Security headers — same posture as docs and marketing. Strict here:
  // the app handles authenticated user data, so we want clickjacking and
  // MIME sniffing locked down.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  // Webpack development source maps require eval. It is never allowed in production.
  serverExternalPackages: ['firebase-admin'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://res.cloudinary.com data: blob:; font-src 'self'; connect-src 'self' https://*.googleapis.com https://securetoken.googleapis.com https://api.cloudinary.com https://res.cloudinary.com http://127.0.0.1:9099 http://localhost:9099 ws://localhost:*; worker-src 'self' blob:; frame-src https://*.firebaseapp.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
                .replace(
                  ' http://127.0.0.1:9099 http://localhost:9099 ws://localhost:*',
                  process.env.NODE_ENV === 'development' ||
                    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL
                    ? ' http://127.0.0.1:9099 http://localhost:9099 ws://localhost:*'
                    : '',
                )
                .replace(
                  "script-src 'self' 'unsafe-inline'",
                  process.env.NODE_ENV === 'development'
                    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
                    : "script-src 'self' 'unsafe-inline'",
                ),
          },
        ],
      },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};
export default config;

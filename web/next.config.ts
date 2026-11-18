import type { NextConfig } from "next";
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const environmentFile = fileURLToPath(new URL('../.env.firebase', import.meta.url));
if (process.env.FUTEIO_E2E_ISOLATED !== '1' && existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const nextConfig: NextConfig = {
  distDir: process.env.FUTEIO_ISOLATED_BUILD === '1' ? '.next-validation' : '.next',
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }];
  },
};

export default nextConfig;

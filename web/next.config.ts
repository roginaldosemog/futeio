import type { NextConfig } from "next";
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const environmentFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(environmentFile)) process.loadEnvFile(environmentFile);

const invalidOriginMessage = 'API_ORIGIN must be an HTTP(S) origin without a path or credentials.';
let apiOrigin: URL;
try {
  apiOrigin = new URL(process.env.API_ORIGIN ?? 'http://localhost:3001');
} catch {
  throw new Error(invalidOriginMessage);
}

if (
  !["http:", "https:"].includes(apiOrigin.protocol) ||
  apiOrigin.username ||
  apiOrigin.password ||
  apiOrigin.pathname !== "/" ||
  apiOrigin.search ||
  apiOrigin.hash
) {
  throw new Error(invalidOriginMessage);
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin.origin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

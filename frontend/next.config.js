/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
  httpAgentOptions: {
    keepAlive: true,
  },
  experimental: {
    proxyTimeout: 120000,
  },
  // Expose backend URL for debugging (build-time only, not sent to browser)
  serverRuntimeConfig: {
    backendUrl,
  },
};

module.exports = nextConfig;

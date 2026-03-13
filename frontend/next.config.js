/** @type {import('next').NextConfig} */
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
  // WebSocket connections cannot be proxied via Next.js rewrites.
  // The frontend connects to the WS backend directly using NEXT_PUBLIC_WS_URL.
};

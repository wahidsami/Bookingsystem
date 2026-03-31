/** @type {import('next').NextConfig} */
const serverUrl = (
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1$/, '') ||
  'http://localhost:5000'
).replace(/\/+$/, '');

const remotePattern = (() => {
  try {
    const url = new URL(serverUrl);
    const pattern = {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      pathname: '/uploads/**',
    };

    if (url.port) {
      pattern.port = url.port;
    }

    return pattern;
  } catch {
    return null;
  }
})();

const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'rapi.unifinitylab.com',
        pathname: '/uploads/**',
      },
      ...(remotePattern ? [remotePattern] : []),
    ],
  },
};

export default nextConfig;



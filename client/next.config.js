/** @type {import('next').NextConfig} */
const apiOrigin = (
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1$/, '') ||
    'http://localhost:5000'
).replace(/\/+$/, '');

const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${apiOrigin}/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;

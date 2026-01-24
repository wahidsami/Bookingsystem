import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Configure for port 3003
  // If needed for production, use environment variable
};

export default withNextIntl(nextConfig);


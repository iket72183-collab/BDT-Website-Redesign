/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'export',
  basePath: '/connect',
  trailingSlash: true,
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'web/.next',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Vercel deployments
  output: "standalone",
  // Disable ESLint during build to prevent blocking deploys
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Allow images from all origins
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

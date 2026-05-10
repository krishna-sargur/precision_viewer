import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/precision_viewer",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/precision_viewer",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

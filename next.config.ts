import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/precision_viewer",
  images: { unoptimized: true },
};

export default nextConfig;

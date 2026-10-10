import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/master-data", destination: "/products", permanent: true }];
  },
};

export default nextConfig;
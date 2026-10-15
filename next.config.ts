import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 30,
    },
  },
};

export default nextConfig;

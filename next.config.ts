// next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  // temporary fix for eslint errors
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },

  // temporary fix for typescript errors
  // typescript: {
  //   // Warning: This allows production builds to successfully complete even if
  //   // your project has TypeScript errors.
  //   ignoreBuildErrors: true,
  // },

  async headers() {
    return [
      {
        // matching all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,DELETE,PATCH,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ];
  }
};

export default nextConfig;
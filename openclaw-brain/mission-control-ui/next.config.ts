import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {
    // Keep project root scoped to this app in a multi-lockfile workspace.
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
}

export default nextConfig

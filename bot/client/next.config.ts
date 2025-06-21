/**
 * Назначение: компонент интерфейса.
 * Основные модули: React, Next.js, Tailwind.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.IS_OUTPUT_EXPORT ? "export" : "standalone",
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static.justboil.me",
      },
    ],
  },
};

export default nextConfig;

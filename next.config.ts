import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ["rss-parser"],
  // el proyecto vive dentro de un monorepo con otro lockfile en la raíz
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;

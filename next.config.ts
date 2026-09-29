import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ["rss-parser", "pg"],
  // el esquema se lee en runtime para crear las tablas la primera vez
  outputFileTracingIncludes: { "/**": ["./supabase/schema.sql"] },
};

export default nextConfig;

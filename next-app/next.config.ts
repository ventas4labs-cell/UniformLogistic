import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin workspace root so Next.js doesn't infer it from the parent Vite project
    root: path.join(__dirname),
  },
  experimental: {
    serverActions: {
      // Default is 1 MB. uploadProductImageAction accepts up to 5 MB
      // (matches the storage.buckets.file_size_limit), so we need a
      // headroom of ~1 MB for the multipart envelope on top.
      bodySizeLimit: '6mb',
    },
  },
};

export default nextConfig;

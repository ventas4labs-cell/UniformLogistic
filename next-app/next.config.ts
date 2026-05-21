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
  images: {
    // Whitelist the Supabase Storage CDN so <Image> can render product
    // photos uploaded through /admin/products. Path is scoped to the
    // public storage endpoint so this doesn't open the door to arbitrary
    // Supabase routes. The `*.supabase.co` wildcard covers whichever
    // project ID the env points at (prod + any preview/branch project).
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;

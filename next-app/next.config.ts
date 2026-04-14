import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin workspace root so Next.js doesn't infer it from the parent Vite project
    root: path.join(__dirname),
  },
};

export default nextConfig;

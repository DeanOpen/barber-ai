import type { NextConfig } from "next";

const config: NextConfig = {
  // OpenNext bundles `.next/standalone/` for the Cloudflare worker. Without
  // this, the build fails with "ENOENT pages-manifest.json".
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default config;

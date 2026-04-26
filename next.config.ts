import type { NextConfig } from "next";

const isShowcase = process.env.NEXT_PUBLIC_SHOWCASE === "1";

const config: NextConfig = {
  // OpenNext bundles `.next/standalone/` for the Cloudflare worker. Without
  // this, the build fails with "ENOENT pages-manifest.json".
  output: "standalone",
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  // In PUBLIC_SHOWCASE builds the server never runs sharp or the OpenAI SDK -
  // every route gates on IS_SHOWCASE and early-returns 410. Aliasing these to
  // false replaces them with empty modules at bundle time, dropping ~700 KB
  // of native + SDK code that would otherwise eat the Cloudflare Worker
  // 3 MiB script-size budget.
  webpack(webpackConfig, { isServer }) {
    if (isShowcase && isServer) {
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        sharp: false,
        openai: false,
      };
    }
    return webpackConfig;
  },
};

export default config;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.exambuddie.app" }],
        destination: "https://exambuddie.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

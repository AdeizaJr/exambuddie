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
      // Year-stamped blog slugs renamed to evergreen ones (2026-10)
      {
        source: "/blog/how-to-score-300-in-jamb-utme-2026",
        destination: "/blog/how-to-score-300-in-jamb-utme",
        permanent: true,
      },
      {
        source: "/blog/waec-2026-how-to-prepare",
        destination: "/blog/how-to-prepare-for-waec",
        permanent: true,
      },
      {
        source: "/blog/waec-2026-timetable",
        destination: "/blog/waec-timetable",
        permanent: true,
      },
      {
        source: "/blog/neco-2026-timetable",
        destination: "/blog/neco-timetable",
        permanent: true,
      },
      {
        source: "/blog/best-jamb-app-nigeria-2026",
        destination: "/blog/best-jamb-app-nigeria",
        permanent: true,
      },
      {
        source: "/blog/jamb-score-university-admission-2026",
        destination: "/blog/jamb-cut-off-marks",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

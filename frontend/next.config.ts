import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  rewrites() {
    return Promise.resolve([
      {
        source: "/api/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://localhost:8080/api/:path*"
            : "http://backend:8080/api/:path*",
      },
    ]);
  },
};

export default nextConfig;
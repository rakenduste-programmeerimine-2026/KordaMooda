import type { NextConfig } from "next";
import { staticSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Content-Security-Policy is per request (nonce), so it is set in src/proxy.ts.
  async headers() {
    return [{ source: "/:path*", headers: staticSecurityHeaders }];
  },
};

export default nextConfig;

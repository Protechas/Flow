import type { NextConfig } from "next";
import packageJson from "./package.json";

function formatBuildDate(raw?: string): string {
  if (raw && /^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw;
  const iso = raw ?? new Date().toISOString().slice(0, 10);
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${y}.${m}.${d}` : iso;
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_APP_BUILD_DATE: formatBuildDate(process.env.NEXT_PUBLIC_APP_BUILD_DATE),
    NEXT_PUBLIC_APP_ENVIRONMENT:
      process.env.NEXT_PUBLIC_APP_ENVIRONMENT ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      "development",
    NEXT_PUBLIC_APP_DEPLOYMENT_SOURCE:
      process.env.NEXT_PUBLIC_APP_DEPLOYMENT_SOURCE ??
      process.env.VERCEL_GIT_COMMIT_REF ??
      process.env.GITHUB_REF_NAME ??
      "local",
  },
};

export default nextConfig;

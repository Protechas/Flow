import type { NextConfig } from "next";
import packageJson from "./package.json";

function formatBuildDate(raw?: string): string {
  if (raw && /^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw;
  const iso = raw ?? new Date().toISOString().slice(0, 10);
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${y}.${m}.${d}` : iso;
}

const vercelUploadCapBytes = 4 * 1024 * 1024;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: process.env.VERCEL ? "4mb" : "25mb",
    },
  },
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
    NEXT_PUBLIC_MAX_TASK_FILE_BYTES: String(
      process.env.VERCEL ? vercelUploadCapBytes : 10 * 1024 * 1024
    ),
    NEXT_PUBLIC_MAX_COMPANY_DOCUMENT_BYTES: String(
      process.env.VERCEL ? vercelUploadCapBytes : 25 * 1024 * 1024
    ),
    NEXT_PUBLIC_MAX_FEEDBACK_ATTACHMENT_BYTES: String(
      process.env.VERCEL ? vercelUploadCapBytes : 10 * 1024 * 1024
    ),
  },
};

export default nextConfig;

import packageJson from "../../../package.json";

export interface AppVersionInfo {
  name: string;
  version: string;
  versionLabel: string;
  buildDate: string;
  buildLabel: string;
  environment: string;
  deploymentSource?: string;
}

function formatBuildDate(raw?: string | null): string {
  if (!raw) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}.${m}.${d}`;
  }
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}.${match[2]}.${match[3]}`;
  return raw;
}

function resolveDeploymentSource(): string | undefined {
  const source =
    process.env.NEXT_PUBLIC_APP_DEPLOYMENT_SOURCE?.trim() ||
    process.env.VERCEL_GIT_COMMIT_REF?.trim() ||
    process.env.GITHUB_REF_NAME?.trim();
  if (!source || source === "local") return undefined;
  return source;
}

/** Single source of truth for app version metadata (package.json + build env). */
export function getAppVersionInfo(): AppVersionInfo {
  const name = packageJson.name === "flow" ? "Flow" : packageJson.name;
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || packageJson.version || "0.0.0";
  const buildDate = formatBuildDate(process.env.NEXT_PUBLIC_APP_BUILD_DATE);
  const environment =
    process.env.NEXT_PUBLIC_APP_ENVIRONMENT?.trim() ||
    process.env.VERCEL_ENV?.trim() ||
    process.env.NODE_ENV ||
    "development";
  const deploymentSource = resolveDeploymentSource();

  return {
    name,
    version,
    versionLabel: `${name} v${version}`,
    buildDate,
    buildLabel: `Build ${buildDate}`,
    environment,
    deploymentSource,
  };
}

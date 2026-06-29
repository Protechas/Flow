import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface PythonJobInput {
  mc_bytes_b64: string;
  export_bytes_b64: string;
  mc_filename: string;
  export_filename: string;
  settings_snapshot: Record<string, unknown>;
}

export interface PythonJobResult {
  status: "completed" | "failed";
  run_summary?: Record<string, unknown>;
  findings?: unknown[];
  artifacts?: { role: string; filename: string }[];
  workbook_b64?: string;
  pdf_b64?: string;
  workbook_filename?: string;
  pdf_filename?: string;
  error?: string;
}

const JOB_TIMEOUT_MS = 35 * 60 * 1000;
const MAX_STDOUT_BYTES = 200 * 1024 * 1024;

function resolveEngineRoot(): string {
  const envRoot = process.env.VALIDATION_ENGINE_ROOT?.trim();
  if (envRoot && existsSync(envRoot)) return envRoot;

  const cwd = process.cwd();
  const candidates = [
    join(/* turbopackIgnore: true */ cwd, "..", "packages", "protech-validation-engine"),
    join(/* turbopackIgnore: true */ cwd, "packages", "protech-validation-engine"),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "protech_validation_engine", "worker", "job_runner.py"))) {
      return candidate;
    }
  }
  throw new Error(
    "Validation engine not found. Install packages/protech-validation-engine or set VALIDATION_ENGINE_ROOT."
  );
}

function resolvePythonCandidates(): string[] {
  const configured = process.env.VALIDATION_ENGINE_PYTHON?.trim();
  const defaults =
    process.platform === "win32"
      ? ["py", "-3", "python", "python3"]
      : ["python3", "python"];
  if (configured) return [configured, ...defaults.filter((c) => c !== configured)];
  return defaults;
}

function spawnPython(
  engineRoot: string,
  pythonArgs: string[]
): ReturnType<typeof spawn> {
  const [command, ...args] = pythonArgs;
  return spawn(command, [...args, "-m", "protech_validation_engine.worker.job_runner"], {
    cwd: engineRoot,
    env: {
      ...process.env,
      PYTHONPATH: engineRoot,
      PYTHONUNBUFFERED: "1",
    },
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
}

export async function runSiLibraryAuditJob(input: PythonJobInput): Promise<PythonJobResult> {
  const engineRoot = resolveEngineRoot();
  const candidates = resolvePythonCandidates();
  const payload = JSON.stringify(input);
  let lastError: Error | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const command = candidates[i];
    const args = command === "py" && candidates[i + 1] === "-3" ? ["-3"] : [];
    const pythonArgs = command === "py" && args.length ? ["py", "-3"] : [command];

    try {
      return await runWithPython(engineRoot, pythonArgs, payload);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      if (msg.includes("enoent") || msg.includes("not found") || msg.includes("spawn")) {
        if (command === "py") i += 1;
        continue;
      }
      throw lastError;
    }
  }

  throw (
    lastError ??
    new Error(
      "Python not found. Install Python 3.10+ and run: pip install -e packages/protech-validation-engine"
    )
  );
}

function runWithPython(
  engineRoot: string,
  pythonArgs: string[],
  payload: string
): Promise<PythonJobResult> {
  return new Promise((resolve, reject) => {
    const child = spawnPython(engineRoot, pythonArgs);
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, JOB_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      if (stdout.length > MAX_STDOUT_BYTES) {
        clearTimeout(timer);
        child.kill("SIGTERM");
        reject(new Error("Validation engine output exceeded size limit"));
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error("Validation engine timed out after 35 minutes"));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim() || "{}") as PythonJobResult;
        if (code !== 0 && parsed.status !== "failed") {
          reject(
            new Error(
              stderr.trim() ||
                stdout.trim() ||
                `Python worker exited with code ${code ?? "unknown"}`
            )
          );
          return;
        }
        if (parsed.status === "failed" && parsed.error) {
          reject(new Error(parsed.error));
          return;
        }
        resolve(parsed);
      } catch {
        reject(
          new Error(
            stderr.trim() ||
              stdout.trim() ||
              `Failed to parse validation engine output (exit ${code ?? "unknown"})`
          )
        );
      }
    });

    child.stdin?.on("error", () => {
      /* child closed before reading stdin */
    });
    child.stdin?.write(payload);
    child.stdin?.end();
  });
}

export async function isValidationEngineAvailable(): Promise<boolean> {
  try {
    const engineRoot = resolveEngineRoot();
    const candidates = resolvePythonCandidates();

    for (let i = 0; i < candidates.length; i++) {
      const command = candidates[i];
      const pythonArgs = command === "py" && candidates[i + 1] === "-3" ? ["py", "-3"] : [command];
      if (command === "py" && candidates[i + 1] === "-3") i += 1;

      const ok = await new Promise<boolean>((resolve) => {
        const [cmd, ...args] = pythonArgs;
        const child = spawn(cmd, [...args, "-c", "import protech_validation_engine"], {
          cwd: engineRoot,
          env: { ...process.env, PYTHONPATH: engineRoot },
          stdio: ["ignore", "ignore", "pipe"],
          windowsHide: true,
        });
        child.on("error", () => resolve(false));
        child.on("close", (code) => resolve(code === 0));
      });
      if (ok) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getValidationEngineRoot(): string | null {
  try {
    return resolveEngineRoot();
  } catch {
    return null;
  }
}

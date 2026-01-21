/**
 * Local Runner Configuration
 */

import { existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import * as os from "os";

function getRepoPath(): string {
  const path = process.env.REPO_PATH;
  if (!path) {
    console.warn("[config] REPO_PATH not set, using current directory");
    return process.cwd();
  }
  return path;
}

function generateRunnerId(): string {
  const hostname = process.env.RUNNER_ID || os.hostname();
  return `runner-${hostname}-${Date.now().toString(36)}`;
}

function detectPackageManager(repoPath: string): "bun" | "pnpm" | "yarn" | "npm" {
  if (existsSync(join(repoPath, "bun.lockb"))) return "bun";
  if (existsSync(join(repoPath, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(repoPath, "yarn.lock"))) return "yarn";
  return "npm";
}

function checkDockerAvailable(): boolean {
  try {
    execSync("docker --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkRipgrepAvailable(): boolean {
  try {
    execSync("rg --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const repoPath = getRepoPath();

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || "",
  runnerToken: process.env.RUNNER_TOKEN || "dev-runner-token",
  runnerId: generateRunnerId(),
  version: "0.3.0",
  repoPath,
  packageManager: detectPackageManager(repoPath),
  port: parseInt(process.env.RUNNER_PORT || "8787", 10),
  dockerEnabled: process.env.DOCKER_ENABLED === "true" && checkDockerAvailable(),
  dockerAvailable: checkDockerAvailable(),
  ripgrepAvailable: checkRipgrepAvailable(),
  os: { platform: os.platform(), arch: os.arch(), release: os.release() },
  heartbeatIntervalMs: 5000,
  pollIntervalMs: 2000,
  commandTimeoutMs: parseInt(process.env.COMMAND_TIMEOUT_MS || "120000", 10),
  maxSearchResults: 20,
  maxFileLines: 500,
  ignorePatterns: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
  patchConstraints: {
    maxFilesChanged: 20,
    maxDiffLines: 1000,
    pathDenylist: [
      ".env",
      ".env.local",
      "node_modules",
      "dist",
      ".git",
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
    ],
    binaryExtensions: [".png", ".jpg", ".gif", ".ico", ".woff", ".pdf", ".zip"],
  },
};

if (!config.supabaseUrl || !config.supabaseKey) {
  console.error("[config] SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  process.exit(1);
}

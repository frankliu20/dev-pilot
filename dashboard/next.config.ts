import type { NextConfig } from "next";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import yaml from "js-yaml";

// Read pilot.yaml at build/startup time and inject into env vars
// so client components can access repo info without importing Node.js modules
function loadPilotEnv(): Record<string, string> {
  const pilotYaml = join(homedir(), '.claude', 'pilot.yaml');
  if (!existsSync(pilotYaml)) return {};

  try {
    const config = yaml.load(readFileSync(pilotYaml, 'utf-8')) as Record<string, unknown>;
    const repos = (config.repos as string[]) || [];
    return {
      NEXT_PUBLIC_GITHUB_REPO: repos[0] || '',
      NEXT_PUBLIC_GITHUB_REPOS: JSON.stringify(repos),
    };
  } catch {
    return {};
  }
}

const pilotEnv = loadPilotEnv();

const nextConfig: NextConfig = {
  env: pilotEnv,
};

export default nextConfig;

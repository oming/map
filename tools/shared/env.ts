import { existsSync, readFileSync } from "node:fs";

export function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split("\n");

  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;

    const idx = line.indexOf("=");
    const key = line.slice(0, idx).trim();
    const value = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function resolveVworldApiKey(): string | undefined {
  return process.env.VWORLD_API_KEY ?? process.env.NEXT_PUBLIC_VWORLD_API_KEY;
}

// app/maplibre-worker/[file]/route.ts
import { readFile } from "fs/promises";
import type { NextRequest } from "next/server";

import path from "path";

const ALLOWED = new Set(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]);

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/maplibre-worker/[file]">,
) {
  const { file } = await ctx.params;
  if (!ALLOWED.has(file)) {
    return new Response("Not found", { status: 404 });
  }
  const filePath = path.join(
    process.cwd(),
    "node_modules/maplibre-gl/dist",
    file,
  );
  const content = await readFile(filePath);
  return new Response(content, {
    headers: { "Content-Type": "application/javascript; charset=utf-8" },
  });
}

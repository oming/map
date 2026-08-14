import { copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];
const srcDir = join(projectRoot, "node_modules/maplibre-gl/dist");
const destDir = join(projectRoot, "public");

await Promise.all(
  files.map((file) => copyFile(join(srcDir, file), join(destDir, file))),
);

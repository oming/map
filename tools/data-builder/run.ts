import { runRecipe } from "./lib/runner.js";
import type { BuildRecipe } from "./lib/recipe-types.js";

const id = process.argv[2];
if (!id) {
  console.error("사용법: tsx tools/data-builder/run.ts <recipe-id>");
  console.error("예시:   tsx tools/data-builder/run.ts toilet-gyeonggi");
  process.exit(1);
}

const recipeModule = await import(`./recipes/${id}.js`).catch(() => null);
const recipe = recipeModule?.recipe as BuildRecipe | undefined;
if (!recipe) {
  console.error(`⚠ 레시피를 찾을 수 없습니다: tools/data-builder/recipes/${id}.ts`);
  process.exit(1);
}

runRecipe(recipe).catch((err) => {
  console.error(err);
  process.exit(1);
});

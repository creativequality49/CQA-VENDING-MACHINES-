import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("lib/cqa-marketplace-assets.ts", "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
const assets = {};
new Function("exports", outputText)(assets);
export const { resolvePurchasedDigitalAsset } = assets;

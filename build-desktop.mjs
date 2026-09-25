import { build } from "vite";
import ts from "typescript";
import tailwind from "@tailwindcss/vite";
await build({
  configFile: false,
  envFile: false,
  resolve: { preserveSymlinks: true },
  plugins: [
    {
      name: "typescript-desktop",
      enforce: "pre",
      transform(code, id) {
        code = code.replaceAll(
          "process.env.NODE_ENV",
          JSON.stringify("production"),
        );
        if (!/\.tsx?$/.test(id)) return { code, map: null };
        return {
          code: ts.transpileModule(code, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2022,
              module: ts.ModuleKind.ESNext,
              jsx: ts.JsxEmit.ReactJSX,
            },
          }).outputText,
          map: null,
        };
      },
    },
    tailwind(),
  ],
  esbuild: false,
  build: { outDir: "dist-desktop", minify: false, target: "esnext" },
});

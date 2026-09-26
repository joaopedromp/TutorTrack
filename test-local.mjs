import { startVitest } from "vitest/node";
import ts from "typescript";
const ctx = await startVitest(
  "test",
  ["tests"],
  {
    config: false,
    watch: false,
    pool: "threads",
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,
  },
  {
    configFile: false,
    resolve: { preserveSymlinks: true },
    esbuild: false,
    plugins: [
      {
        name: "ts-without-subprocess",
        enforce: "pre",
        transform(code, id) {
          if (/\.tsx?$/.test(id))
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
    ],
  },
);
const failed =
  !ctx ||
  ctx.state.getFiles().length === 0 ||
  ctx.state.getFiles().some((file) => file.result?.state === "fail") ||
  ctx.state.getUnhandledErrors().length > 0;
await ctx?.close();
if (failed) process.exitCode = 1;

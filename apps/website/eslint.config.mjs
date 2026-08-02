/**
 * @purpose ESLint 扁平配置：next core-web-vitals + typescript，并覆盖默认忽略项。
 * @role    pnpm --filter @listenup/website lint 使用；全仓唯一配了 lint 的 app。
 * @deps    eslint-config-next
 * @gotcha  生成物目录（.next / out / next-env.d.ts）在这里显式忽略
 */
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

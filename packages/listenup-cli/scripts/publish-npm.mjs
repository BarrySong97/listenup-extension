#!/usr/bin/env node
/**
 * @purpose 发布已生成并检查过的 ListenUp CLI npm artifact。
 * @role    使用调用者本地 npm 认证的薄发布入口。
 * @deps    npm CLI、node:child_process、node:os
 * @gotcha  不读取或打印 token；认证只能来自 npm 环境或被 Git 忽略的本地配置。
 */
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCache =
  process.env.npm_config_cache ?? join(tmpdir(), "listenup-cli-npm-cache");

execFileSync("node", ["./scripts/pack-dry.mjs"], {
  cwd: packageRoot,
  env: { ...process.env, npm_config_cache: npmCache },
  stdio: "inherit",
});
execFileSync("npm", ["publish", "./npm", "--access", "public"], {
  cwd: packageRoot,
  env: { ...process.env, npm_config_cache: npmCache },
  stdio: "inherit",
});

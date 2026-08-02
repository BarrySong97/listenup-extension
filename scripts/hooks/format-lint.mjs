#!/usr/bin/env node
/**
 * @purpose PostToolUse 质量回灌:改完文件后跑格式化/lint,把报错作为 additionalContext 喂回 agent 自纠。
 * @role    强制层 sensor(最快层,毫秒~秒);Claude / Codex 共用。
 * @deps    node 内置 + 项目自己的 lint/format 命令(在 LINT_CMD 填,用 {{FILE}} 占位)
 * @gotcha  按技术栈改 LINT_CMD;留空则不动(先靠 check-docs / pre-commit 兜底)。成功静默,只在有问题时回灌。
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let payload = {};
try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}
const file = payload?.tool_input?.file_path ?? '';
if (!file) process.exit(0);

// ⬇️ 单文件 lint/format 命令,保留 {{FILE}} 占位。
//
// 本仓库当前**故意留空**:全仓没有统一的单文件 linter——只有 apps/website 配了
// eslint(且是整包跑,不接受单文件),extension / desktop / mock-ui 都没有。
// 硬塞一个 npx 命令只会在没装的机器上每次改文件都报错。
// 补齐工具链(oxlint / biome 之类)后在这里填上,例如:
//   'npx oxlint "{{FILE}}" && npx biome format --write "{{FILE}}"'
// 在那之前,质量兜底靠 DoD 里的构建 + check-docs。见 docs/decisions/0006-adopt-ai-doc-system.md
const LINT_CMD = '';

if (!LINT_CMD) process.exit(0);
try {
  execSync(LINT_CMD.replaceAll('{{FILE}}', file), { stdio: ['ignore', 'pipe', 'pipe'] });
  process.exit(0); // 成功:静默
} catch (e) {
  const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
  if (out) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `Lint/format 报告(${file}):\n${out}`,
      },
    }));
  }
  process.exit(0);
}

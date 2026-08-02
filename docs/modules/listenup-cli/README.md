# listenup-cli（`packages/listenup-cli/`）

## 职责

把 Desktop Rust crate 中现有的安全 `listenup` CLI 作为独立 npm 包分发。该层只负责构建、
平台限制、进程转发和 npm artifact 校验；字幕查询、翻译映射校验与 SQLite 事务仍由
`apps/listenup-desktop/src-tauri` 维护。

首个公开版本是 `@barrysongdev4real/listenup-cli@0.1.0`，仅支持 macOS Apple Silicon。

## 文件清单

```text
package.json             workspace 与版本权威
bin/listenup.mjs         npm bin 启动器；校验平台并转发进程
scripts/build.mjs        注入 CLI 版本、构建 Rust 并生成 npm/
scripts/pack-dry.mjs     npm tarball 文件允许列表与权限检查
scripts/smoke-test.mjs   正式数据库备份上的隔离 dry-run / commit 往返
scripts/publish-npm.mjs  使用调用者本地认证发布 public scoped package
npm/                     生成物，不提交
```

## 架构边界

- Node 启动器不读数据库、不解析或重写 CLI JSON、不实现业务命令。
- Rust CLI 版本由 `LISTENUP_CLI_VERSION` 编译期注入，与 Desktop 版本解耦。
- npm `os` / `cpu`、构建脚本和运行时启动器都限制 `darwin-arm64`。
- npm 包直接携带二进制，不在 install 或首次运行时下载远端产物。
- 发布脚本不读取或打印 token；项目根 `.npmrc` 仅作为被 Git 忽略的本地凭据文件。

## 构建与验证

```bash
pnpm --filter @barrysongdev4real/listenup-cli build
pnpm --filter @barrysongdev4real/listenup-cli pack:dry
packages/listenup-cli/npm/bin/listenup.mjs --version
pnpm --filter @barrysongdev4real/listenup-cli smoke -- --source-db \
  "$HOME/Library/Application Support/com.listenup.desktop/listenup.sqlite"
```

发布前还必须把 tarball 安装到临时 prefix，对临时 SQLite 完成 `info`、subtitle get、
translation dry-run / commit / get 往返，并确认包中只有允许的五个文件。

# Native Host 正式/DEV 环境隔离实施计划

- 状态：已批准，执行中
- 日期：2026-07-27

## 目标

正式扩展与 DEV 扩展保持完全相同的 Native Messaging 字幕同步能力，但使用互不相同的 Extension ID、Native Host 名、Desktop bundle ID、深链接和 socket。正式 Desktop 安装后启动一次即可自动注册 Host。

## 实施

1. 建立正式/DEV 单一环境矩阵，并增加防漂移 sensor。
2. Desktop GUI 启动时按编译环境幂等写入 Host manifest 与 wrapper。
3. 正式扩展保留必需的 `nativeMessaging`，移除会产生错误正式 ID 的本地 manifest key。
4. 同步 ADR、模块、测试、隐私政策与发布文档。
5. 构建两套扩展与 Desktop，运行 Rust tests 和 sensors，再制作正式商店更新包。

## 验收

- 正式扩展只连接 `com.listenup.desktop`，且 Host 只允许 `nocahdalbgboblhbjkacpneakljldfjh`。
- DEV 扩展只连接 `com.listenup.desktop.dev`，且 Host 只允许 `gbnneflaaakigllkomehhhaianjebljf`。
- 两套 Desktop 可同时运行，bundle、scheme、socket、日志与 Host 注册互不覆盖。
- Desktop 未安装或 Host 注册失败不影响扩展字幕面板。

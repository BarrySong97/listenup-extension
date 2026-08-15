# Extension 中英文 i18n — 实施计划

- 日期：2026-08-15
- 状态：实现完成，待验收
- Plane：LISTENUP-24

## 目标与范围

为浏览器扩展接入 `i18next` + `react-i18next`，首期只提供英文与简体中文。覆盖 MV3 manifest、
YouTube 内容脚本字幕面板、Popup、Options 和 UI Preview 的用户可见界面；Desktop、Website、字幕
原文和诊断日志不在本次范围。

默认语言跟随浏览器 UI，用户显式选择后写入 `chrome.storage.local`，所有已打开的扩展页面通过
storage change 事件同步。缺少翻译时回退英文。

## 实施步骤

1. [x] 安装 `i18next` 与 `react-i18next`，建立类型安全的 `en` / `zh-CN` 资源、初始化入口与
   React Provider。
2. [x] 建立共享语言切换组件，把选择持久化到扩展存储，并处理跨页面同步。
3. [x] 翻译内容脚本、Popup、Options、AI 设置与 Preview 的用户可见文案及无障碍标签。
4. [x] 启用现有 MV3 locale 构建插件，补齐 `en` / `zh_CN` manifest 名称与描述。
5. [x] 增加语言规范化、持久化、资源完整性与构建产物自动化检查，防止语言键和入口漂移。
6. [x] 同步 Extension 模块文档与测试清单，跑 Extension tests、Chrome/Firefox/DEV 构建、
   docs sensors，并在真实浏览器预览页切换中英文核对 DOM 与布局。

## 验收标准

- 英文与简体中文可以在界面即时切换，重开扩展后保持用户选择。
- 未设置偏好时，中文浏览器使用中文，其他语言使用英文。
- 内容脚本、Popup、Options、Preview 和 manifest 均使用对应语言；翻译键无缺失。
- `pnpm --filter @listenup/extension test`、Chrome/Firefox 构建与 `node scripts/check-docs.mjs`
  全部通过。

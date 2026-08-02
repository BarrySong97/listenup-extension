# 官网去版本号与原始音轨字幕选轨 — 实施计划

- 日期：2026-08-02
- 状态：已完成
- 关联决策：`docs/decisions/0008-desktop-sqlite-bilingual-subtitles-and-safe-cli.md`

## 方案概述

官网的 macOS 下载链接继续使用 GitHub Releases 的 `/releases/latest`，但删除导航和下载按钮里
手写的版本号，避免 Desktop 每次发版都要修改静态页面。

Extension 不再把当前字幕顺序或当前配音/字幕偏好当成视频原语。页面桥接从 YouTube
`streamingData` 中读取 `audioTrack.audioIsDefault` 标记的原始音轨，并把其语言代码映射到字幕
轨；默认选轨优先级调整为“原始音轨语言 → YouTube 默认字幕 → 第一条可用字幕”。原文语言
不接受用户或调用方覆盖，同语言内继续优先人工字幕。

## 涉及文件 / 模块

- `apps/website/app/page.tsx` — 删除所有可见的手写 Desktop 版本号。
- `apps/extension/public/scripts/inject-youtube.js` — 暴露原始音轨元数据。
- `apps/extension/src/pages/content/lib/captions/` — 规范化原始音轨语言、保留跨来源身份标记并选轨。
- `apps/extension/src/pages/content/lib/subtitle-domain/SubtitleRepository.ts` — 去重时合并语言身份标记。
- `scripts/check-environment-identifiers.mjs` — 锁定无手写官网版本号和原始音轨优先策略。
- `docs/modules/`、`docs/topics/`、ADR 与测试清单 — 同步产品行为和回归要求。

## 任务拆解

1. [x] 删除官网 `VERSION` 常量及两处展示，保持静态 `/releases/latest` 下载链接。
2. [x] 从真实 YouTube player response 提取 `audioIsDefault` 原始音轨并解析 BCP 47 语言代码。
3. [x] 让字幕轨携带 `isOriginalAudioLanguage`，去重时 OR 合并 default/original 标记。
4. [x] 更新选择器优先级并增加原始英语对葡萄牙语顺序/默认误导的回归测试。
5. [x] 更新文档、ADR 和 sensor，运行 Extension 测试/构建与 Website 静态构建。

## 风险 / 注意

- `getAudioTrack()` 表示当前播放音轨，可能受用户配音偏好影响，不能用作“原始音轨”。
- `audioTracks[0]` 也不可靠；多配音视频的第一个条目可能是任意配音语言。
- 原始音轨 ID 当前形如 `en-US.4`，解析失败时必须安全回退现有 default/首轨策略。
- 页面桥接与内容脚本属于不同 JS 上下文；payload 类型和解析逻辑必须同步。
- 不改变 Native Messaging v3 契约，Desktop 仍只接收最终选中的字幕轨。

## 验证方式

```bash
pnpm --filter @listenup/extension test
pnpm build:extension
pnpm build:extension:native-demo
pnpm --filter @listenup/website lint
pnpm build:web:static
node scripts/check-environment-identifiers.mjs
node scripts/check-docs.mjs
```

真实回归使用带多语言自动配音的英语视频 `lvKA9rH_WlU`：即使字幕列表第一项是葡萄牙语，
原始音轨 `en-US.*` 也必须使 Extension/Desktop 选择英语字幕。

2026-08-02 在独立 Chrome Profile 加载 DEV Extension、启动唯一的
`/Applications/ListenUp Desktop DEV.app` 后完成实测：player response 的原始音轨为
`en-US.4`，扩展下载 URL 使用 `lang=en`；即使把当前 YouTube 配音临时切换为
`Portuguese (BR)`，Desktop 仍显示 `English`，DEV SQLite 的 `.en` revision 含 422 个语义
块。测试结束后已恢复 `English (US) original` 音轨。

# 0002. dev 与 production 桌面端做成两个完全独立的 app

- 状态：已采纳
- 日期：2026-07-25（回填历史决策）

## 背景

桌面端要靠 Chrome Native Messaging 连扩展，而 Native Messaging 的 host manifest 是**按 host 名注册在系统目录里的全局资源**，深链接 scheme 同样由 LaunchServices 全局注册。如果 dev 和 production 共用同一套标识，开发中的构建会劫持正式 app 的连接，反之亦然，且很难察觉。

## 决策

按构建时的 `LISTENUP_ENV` 生成两个互不干扰的 app：不同 productName、bundle id、深链接 scheme、Native host 名、socket 路径，扩展侧也对应两套 Extension ID。标识的唯一权威是 `config/listenup-environments.json`。

## 理由

- 全局注册项冲突只能靠"标识不同"解决，运行时判断来不及
- 两套并存才能一边用正式版一边开发
- socket 路径按 bundle id 派生（`build.rs` 把 `LISTENUP_ENV` 透传给 Rust），自然跟着隔离
- Chrome profile 只隔离扩展安装；Native Host 注册目录仍由同一 macOS 用户共享，所以 Host 名也必须不同

备选：单 app + 运行时开关。否决——host manifest 和 URL scheme 是安装期注册的，运行时开关管不到。

## 后果

- 好处：dev 与 production 可同时安装、同时运行，互不抢连接
- 好处：环境标识集中在 `config/listenup-environments.json`，构建脚本与 sensor 会阻止 ID 漂移
- 代价：Tauri config 仍保留 identifier / productName overlay，因此 sensor 必须校验它们与环境矩阵一致
- 代价：`src-tauri/Info.plist` 是生成物，可能被最后一次本地构建切换 scheme——production CI 与 DEV 构建都必须按目标环境重新生成（见 [release-and-distribution](../topics/release-and-distribution.md)）
- 完整对照表见 [listenup-desktop 模块文档](../modules/listenup-desktop/README.md)

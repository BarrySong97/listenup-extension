/**
 * @purpose 挂载 Desktop 内置播放器的本地可信 UI。
 * @role    player.html 入口；与远程 youtube child WebView 保持不同 label/capability。
 * @deps    react-dom/client、PlayerShell、styles.css
 * @gotcha  本入口只上报视频槽 bounds，不直接渲染或代理 YouTube 页面。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import PlayerShell from "./PlayerShell";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PlayerShell />
  </React.StrictMode>
);

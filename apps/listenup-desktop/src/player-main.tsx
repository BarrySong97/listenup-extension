/**
 * @purpose 挂载 Desktop 内置播放器的本地可信 UI。
 * @role    player.html 入口；与远程 youtube child WebView 保持不同 label/capability。
 * @deps    react-dom/client、@tanstack/react-query、PlayerShell、styles.css
 * @gotcha  独立 QueryClient 避免引入 main 的窗口权限副作用；本入口不直接渲染或代理 YouTube 页面。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import PlayerShell from "./PlayerShell";
import "./styles.css";

const playerQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={playerQueryClient}>
      <PlayerShell />
    </QueryClientProvider>
  </React.StrictMode>
);

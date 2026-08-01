/**
 * @purpose 桌面端前端的 React 挂载入口。
 * @role    index.html 加载它，渲染 App。
 * @deps    react-dom/client、@tanstack/react-query、./queryClient、./App、./styles.css
 * @gotcha  QueryClient 必须保持单例，窗口 focus refetch 才能读取 CLI 刚提交的数据。
 */
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { queryClient } from "./queryClient";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

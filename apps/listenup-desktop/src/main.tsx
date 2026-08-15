/**
 * @purpose 桌面端前端的 React 挂载入口。
 * @role    index.html 加载它，渲染 App。
 * @deps    react-dom/client、@tanstack/react-query、./i18n、./queryClient、./App、./styles.css
 * @gotcha  QueryClient 必须保持单例；i18n Provider 必须包住 App，所有 Desktop surface 才共享语言。
 */
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DesktopI18nProvider } from "./i18n";
import { queryClient } from "./queryClient";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DesktopI18nProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </DesktopI18nProvider>
  </React.StrictMode>
);

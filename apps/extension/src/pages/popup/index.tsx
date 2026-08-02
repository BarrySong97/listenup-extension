/**
 * @purpose popup 页面的 React 挂载入口。
 * @role    manifest 的 action.default_popup 指向的 HTML 加载它。
 * @deps    react-dom/client、@heroui/react、./Popup
 * @gotcha  复用了内容脚本的 style.css，改那份样式会连带影响 popup
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import "@pages/popup/index.css";
import "@pages/content/style.css";
import Popup from "@pages/popup/Popup";

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Popup root element");
  const root = createRoot(rootContainer);
  root.render(
    <HeroUIProvider>
      <Popup />
    </HeroUIProvider>
  );
}

init();

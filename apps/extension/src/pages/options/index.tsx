/**
 * @purpose options 页面的 React 挂载入口。
 * @role    manifest 的 options_ui.page 指向的 HTML 加载它。
 * @deps    react-dom/client、@heroui/react、./Options
 * @gotcha  同样复用内容脚本的 style.css
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import Options from "@pages/options/Options";
import "@pages/options/index.css";
import "@pages/content/style.css";

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Options root element");
  const root = createRoot(rootContainer);
  root.render(
    <HeroUIProvider>
      <Options />
    </HeroUIProvider>
  );
}

init();

/**
 * @purpose UI Preview 页面的 React 挂载入口。
 * @role    开发调试页，由 popup 或直接 URL 打开。
 * @deps    react-dom/client、@heroui/react、src/i18n、./Newtab
 * @gotcha  不是给终端用户的页面
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import Newtab from "@pages/newtab/Newtab";
import "@pages/newtab/index.css";
import "@pages/content/style.css";
import { ExtensionI18nProvider } from "@src/i18n";

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Newtab root element");
  const root = createRoot(rootContainer);
  root.render(
    <ExtensionI18nProvider>
      <HeroUIProvider>
        <Newtab />
      </HeroUIProvider>
    </ExtensionI18nProvider>
  );
}

init();

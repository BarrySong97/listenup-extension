import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import styleText from "./style.css?inline";
import Subtitles from "./components/subtitles";

// 创建Shadow DOM容器
const hostDiv = document.createElement("div");
hostDiv.id = "__listenup-extension-host";
hostDiv.style.position = "relative";
hostDiv.style.zIndex = "9999";

// 创建Shadow Root
const shadowRoot = hostDiv.attachShadow({ mode: "open" });

// 创建React根容器
const reactContainer = document.createElement("div");
reactContainer.id = "__root";
reactContainer.style.fontSize = "16px";

// 注入Tailwind CSS到Shadow DOM
const injectStyles = () => {
  // 注入Tailwind CSS (通过Vite的?inline导入)
  const tailwindStyle = document.createElement("style");
  tailwindStyle.textContent = styleText;
  shadowRoot.appendChild(tailwindStyle);

  // 添加基础样式确保组件正常显示
  const baseStyleElement = document.createElement("style");
  baseStyleElement.textContent = `
    :host {
      all: initial;
      position: relative;
      z-index: 9999;
    }
    * {
      box-sizing: border-box;
    }
  `;
  shadowRoot.appendChild(baseStyleElement);
};

// 注入样式
injectStyles();

// 将React容器添加到Shadow DOM
shadowRoot.appendChild(reactContainer);

// 将Shadow DOM host添加到页面
document.body.appendChild(hostDiv);

// 创建React根
const root = createRoot(reactContainer);
root.render(
  <HeroUIProvider>
    <Subtitles />
  </HeroUIProvider>
);

try {
  console.log("content script loaded");
} catch (e) {
  console.error(e);
}

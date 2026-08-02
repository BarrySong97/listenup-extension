/**
 * @purpose 内容脚本入口：判域名、建 Shadow DOM、注入样式、挂载 React。
 * @role    整条内容脚本链路的起点，由 manifest 的 content_scripts 注入。
 * @deps    react-dom/client、@heroui/react、jotai、./style.css?inline、./app
 * @gotcha  样式必须 inline 注入并把 rem 换成 em；宿主节点 id 为 #__listenup-extension-host。见 docs/decisions/0001-content-script-shadow-dom.md
 */
import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import { Provider } from "jotai";
import styleText from "./style.css?inline";
import App from "./app";
const init = () => {
  // 创建Shadow DOM容器
  const hostDiv = document.createElement("div");
  hostDiv.id = "__listenup-extension-host";
  hostDiv.style.position = "relative";
  hostDiv.style.zIndex = "99999999";

  // 创建Shadow Root
  const shadowRoot = hostDiv.attachShadow({ mode: "open" });

  // 创建React根容器
  const reactContainer = document.createElement("div");
  reactContainer.id = "__root";
  reactContainer.style.fontSize = "16px";

  // 注入Tailwind CSS到Shadow DOM
  const injectStyles = () => {
    // 转换CSS以适配Shadow DOM，将:root和html选择器转换为:host

    // 注入转换后的Tailwind CSS
    const tailwindStyle = document.createElement("style");
    tailwindStyle.textContent = styleText.replaceAll("rem", "em");
    shadowRoot.appendChild(tailwindStyle);
  };

  // 注入样式
  injectStyles();

  // 将React容器添加到Shadow DOM
  shadowRoot.appendChild(reactContainer);

  const html = document.querySelector("html");
  html?.appendChild(hostDiv);

  // 创建React根
  const root = createRoot(reactContainer);
  root.render(
    <Provider>
      <HeroUIProvider>
        <App />
      </HeroUIProvider>
    </Provider>
  );

  // 视频变化检测
};
const isYoutube = () => {
  const isYoutube = window.location.hostname.includes("youtube.com");

  return isYoutube;
};
if (isYoutube()) {
  init();
}

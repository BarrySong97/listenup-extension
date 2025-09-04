import { createRoot } from "react-dom/client";
import { HeroUIProvider } from "@heroui/react";
import { Provider } from "jotai";
import styleText from "./style.css?inline";
import Subtitles from "./components/subtitles";
const init = () => {
  // 创建Shadow DOM容器
  const hostDiv = document.createElement("div");
  hostDiv.id = "__listenup-extension-host";
  hostDiv.style.position = "relative";
  hostDiv.style.zIndex = "999";

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
        <Subtitles />
      </HeroUIProvider>
    </Provider>
  );

  // 视频变化检测
};
const isYoutube = () => {
  const isYoutube = window.location.hostname.includes("youtube.com");
  const isVideoPage =
    isYoutube &&
    (window.location.pathname === "/watch" ||
      window.location.search.includes("v=") ||
      window.location.pathname.startsWith("/watch"));
  return isYoutube && isVideoPage;
};
if (isYoutube()) {
  init();
}

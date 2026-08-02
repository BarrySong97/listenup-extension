/**
 * @purpose 监听 YouTube SPA 导航，只在 watch 页渲染字幕面板。
 * @role    index.tsx 与 components/subtitles.tsx 之间的路由层。
 * @deps    yt-navigate-finish 事件、./components/subtitles
 * @gotcha  用 videoId 作 key 强制重建，防止旧视频状态泄漏到新视频；见 docs/modules/extension/content.md
 */
import { FC, useEffect, useState } from "react";
import Subtitles from "./components/subtitles";
export interface AppProps {}

const App: FC<AppProps> = () => {
  const [isYoutube, setIsYoutube] = useState(false);
  const [videoId, setvideoId] = useState<string>();
  useEffect(() => {
    const isYoutube = () => {
      const isVideoPage =
        window.location.pathname === "/watch" ||
        window.location.search.includes("v=") ||
        window.location.pathname.startsWith("/watch");
      const regex = /(?:v=|\/)([0-9A-Za-z_-]{11})(?:\?|&|\/|$)/;

      const youtubeId = window.location.href.match(regex);
      if (youtubeId) {
        setvideoId(youtubeId[1]);
      }

      setIsYoutube(isVideoPage);
    };
    isYoutube();
    window.addEventListener("yt-navigate-finish", isYoutube);
    return () => {
      window.removeEventListener("yt-navigate-finish", isYoutube);
    };
  }, []);
  if (!isYoutube) {
    return null;
  }
  return <Subtitles key={videoId} />;
};

export default App;

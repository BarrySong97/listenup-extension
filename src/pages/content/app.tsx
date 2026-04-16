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

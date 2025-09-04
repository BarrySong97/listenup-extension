import { FC, useEffect, useState } from "react";
import Subtitles from "./components/subtitles";
export interface AppProps {}
const App: FC<AppProps> = () => {
  const [isYoutube, setIsYoutube] = useState(false);
  useEffect(() => {
    const isYoutube = () => {
      const isVideoPage =
        window.location.pathname === "/watch" ||
        window.location.search.includes("v=") ||
        window.location.pathname.startsWith("/watch");
      setIsYoutube(isVideoPage);
    };
    window.addEventListener("yt-navigate-finish", isYoutube);
    return () => {
      window.removeEventListener("yt-navigate-finish", isYoutube);
    };
  }, []);
  if (!isYoutube) {
    return null;
  }
  return <Subtitles />;
};

export default App;

import { useState, useEffect } from "react";
import { youtubeSDK, YouTubeTheme } from "@src/lib/youtube-sdk";

/**
 * React hook for YouTube theme detection using the YouTube SDK
 */
export const useYouTubeTheme = () => {
  const [theme, setTheme] = useState<YouTubeTheme>("light");

  useEffect(() => {
    // Get initial theme
    const themeDetector = youtubeSDK.getThemeDetector();
    setTheme(themeDetector.getCurrentTheme());

    // Start monitoring if not already started
    themeDetector.startMonitoring();

    // Set callback for theme changes
    themeDetector.setCallback((newTheme) => {
      setTheme(newTheme);
    });

    // Cleanup
    return () => {
      // Don't stop monitoring as other components might be using it
      // Just clear our callback
      themeDetector.setCallback(null);
    };
  }, []);

  return {
    theme,
    isLight: theme === "light",
    isDark: theme === "dark",
  };
};

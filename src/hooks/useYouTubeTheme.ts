import { useState, useEffect } from "react";

export type YouTubeTheme = "dark" | "light";

/**
 * 检测YouTube当前主题模式的Hook
 */
export const useYouTubeTheme = () => {
  const [theme, setTheme] = useState<YouTubeTheme>("light");

  // 检测YouTube主题的函数
  const detectYouTubeTheme = (): YouTubeTheme => {
    // 方法1: 检查html标签的dark属性
    const htmlElement = document.documentElement;
    if (htmlElement.hasAttribute("dark")) {
      return "dark";
    }

    // 默认返回dark（YouTube默认主题）
    return "light";
  };

  // 初始化和监听主题变化
  useEffect(() => {
    const updateTheme = () => {
      const detectedTheme = detectYouTubeTheme();
      setTheme(detectedTheme);

      console.log("🎨 检测到YouTube主题:", detectedTheme);
    };

    // 初始检测
    updateTheme();

    // 创建MutationObserver监听DOM变化
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        // 监听html标签的属性变化
        if (
          mutation.type === "attributes" &&
          (mutation.target as Element).tagName === "HTML"
        ) {
          shouldUpdate = true;
        }

        // 监听YouTube app元素的变化
        if (
          mutation.type === "attributes" &&
          (mutation.target as Element).tagName === "YTD-APP"
        ) {
          shouldUpdate = true;
        }
      });

      if (shouldUpdate) {
        setTimeout(updateTheme, 100); // 稍微延迟以确保DOM完全更新
      }
    });

    // 监听html和ytd-app元素
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dark"],
    });

    const ytdApp = document.querySelector("ytd-app");
    if (ytdApp) {
      observer.observe(ytdApp, {
        attributes: true,
        attributeFilter: ["class", "style"],
      });
    }

    // 监听系统主题变化
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      setTimeout(updateTheme, 100);
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  return {
    theme,
    isLight: theme === "light",
    isDark: theme === "dark",
  };
};

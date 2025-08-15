import { useState, useEffect } from 'react';

export type YouTubeTheme = 'dark' | 'light';

/**
 * 检测YouTube当前主题模式的Hook
 */
export const useYouTubeTheme = () => {
  const [theme, setTheme] = useState<YouTubeTheme>('dark');

  // 检测YouTube主题的函数
  const detectYouTubeTheme = (): YouTubeTheme => {
    // 方法1: 检查html标签的dark属性
    const htmlElement = document.documentElement;
    if (htmlElement.hasAttribute('dark') || htmlElement.getAttribute('data-theme') === 'dark') {
      return 'dark';
    }

    // 方法2: 检查YouTube特定的主题类
    const ytdAppElement = document.querySelector('ytd-app');
    if (ytdAppElement) {
      const computedStyle = window.getComputedStyle(ytdAppElement);
      const backgroundColor = computedStyle.backgroundColor;
      
      // YouTube dark mode 通常有深色背景
      if (backgroundColor.includes('rgb(15, 15, 15)') || 
          backgroundColor.includes('rgb(33, 33, 33)') ||
          backgroundColor.includes('#0f0f0f')) {
        return 'dark';
      }
    }

    // 方法3: 检查body的背景色
    const bodyStyle = window.getComputedStyle(document.body);
    const bodyBg = bodyStyle.backgroundColor;
    
    // 解析RGB值来判断亮度
    const rgbMatch = bodyBg.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      return brightness < 128 ? 'dark' : 'light';
    }

    // 方法4: 检查CSS变量（YouTube可能使用的）
    const rootStyle = getComputedStyle(document.documentElement);
    const ytBgColor = rootStyle.getPropertyValue('--yt-spec-base-background') || 
                     rootStyle.getPropertyValue('--ytd-searchbox-background');
    
    if (ytBgColor && (ytBgColor.includes('#0f') || ytBgColor.includes('15, 15, 15'))) {
      return 'dark';
    }

    // 默认返回dark（YouTube默认主题）
    return 'dark';
  };


  // 初始化和监听主题变化
  useEffect(() => {
    const updateTheme = () => {
      const detectedTheme = detectYouTubeTheme();
      setTheme(detectedTheme);
      
      console.log('🎨 检测到YouTube主题:', detectedTheme);
    };

    // 初始检测
    updateTheme();

    // 创建MutationObserver监听DOM变化
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        // 监听html标签的属性变化
        if (mutation.type === 'attributes' && 
            (mutation.target as Element).tagName === 'HTML') {
          shouldUpdate = true;
        }
        
        // 监听YouTube app元素的变化
        if (mutation.type === 'attributes' && 
            (mutation.target as Element).tagName === 'YTD-APP') {
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
      attributeFilter: ['dark', 'data-theme', 'class']
    });

    const ytdApp = document.querySelector('ytd-app');
    if (ytdApp) {
      observer.observe(ytdApp, {
        attributes: true,
        attributeFilter: ['class', 'style']
      });
    }

    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      setTimeout(updateTheme, 100);
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  return {
    theme,
    isLight: theme === 'light',
    isDark: theme === 'dark',
  };
};
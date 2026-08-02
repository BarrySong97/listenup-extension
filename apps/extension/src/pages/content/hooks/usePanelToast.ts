/**
 * @purpose 面板 toast 的显示与自动消失。
 * @role    被 subtitles.tsx / 预览页调用，喂给 SubtitlePanelToast。
 * @deps    react
 * @gotcha  卸载时清 timeout，避免 Shadow DOM 重建后回调打到已卸载组件
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const usePanelToast = (duration = 1600) => {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const clearToast = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setToastMessage(null);
  }, []);

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        setToastMessage(null);
      }, duration);
    },
    [duration]
  );

  return {
    toastMessage,
    showToast,
    clearToast,
  };
};

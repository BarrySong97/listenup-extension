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

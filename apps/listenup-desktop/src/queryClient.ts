/**
 * @purpose 配置 Desktop 的 TanStack Query 缓存与窗口重新聚焦刷新行为。
 * @role    main.tsx 唯一 QueryClient 实例。
 * @deps    @tanstack/react-query、@tauri-apps/api/window
 * @gotcha  不设置轮询或 SQLite watcher；CLI 数据只在 mount、query key 变化或窗口 focus 时重取。
 */
import { focusManager, QueryClient } from "@tanstack/react-query";
import { getCurrentWindow } from "@tauri-apps/api/window";

focusManager.setEventListener((handleFocus) => {
  let unlisten: (() => void) | null = null;
  void getCurrentWindow()
    .onFocusChanged((event) => handleFocus(event.payload))
    .then((dispose) => {
      unlisten = dispose;
    })
    .catch((error) => console.error("failed to observe desktop focus", error));
  return () => unlisten?.();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 0,
      retry: 1,
    },
  },
});

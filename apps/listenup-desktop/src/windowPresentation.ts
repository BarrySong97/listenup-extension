/**
 * @purpose 固定同一 main 的列表/影院视图类型、原生返回列表事件与分模式几何键。
 * @role    App.tsx 的单 WebView 呈现契约：React 管视图，Rust 成对切换同一原生窗口语义。
 * @deps    无
 * @gotcha  tray/关闭可从原生侧恢复 list；事件名必须稳定，且 list/cinema 仍使用不同几何键。
 */
export type WindowViewMode = "list" | "cinema";

export const RETURN_TO_LIST_EVENT = "desktop-return-to-list";

export const WINDOW_GEOMETRY_STORAGE_KEYS: Record<
  WindowViewMode,
  { position: string; size: string }
> = {
  list: {
    position: "listenup-window-position-main-v2",
    size: "listenup-window-size-main-v2",
  },
  cinema: {
    position: "listenup-window-position-cinema-v2",
    size: "listenup-window-size-cinema-v2",
  },
};

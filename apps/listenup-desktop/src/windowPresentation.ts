/**
 * @purpose 固定 Tauri 窗口 label、影院呈现事件与双窗口几何键。
 * @role    App.tsx 的窗口职责边界：main/未知窗口渲染列表，cinema 标签渲染影院浮层并接收每次呈现通知。
 * @deps    无
 * @gotcha  cinema 会隐藏后复用；每次呈现必须由原生事件重置入场提示并触发延后 tracking refresh。
 */
export type WindowViewMode = "list" | "cinema";

export const CINEMA_PRESENTED_EVENT = "desktop-cinema-presented";

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

export const resolveWindowViewMode = (label: string): WindowViewMode =>
  label === "cinema" ? "cinema" : "list";

/**
 * @purpose 将 Tauri 窗口 label 映射为唯一允许的 Desktop 视图形态。
 * @role    App.tsx 的窗口职责边界：main/未知窗口渲染列表，只有 cinema 标签渲染影院浮层。
 * @deps    无
 * @gotcha  不得从本地偏好恢复 Menubar 或用普通窗口冒充 cinema；原生窗口属性由 Rust label 分流。
 */
export type WindowViewMode = "list" | "cinema";

export const resolveWindowViewMode = (label: string): WindowViewMode =>
  label === "cinema" ? "cinema" : "list";

/**
 * @purpose 决定 appMode 切换时使用哪个视图、尺寸来源以及是否真的改窗口尺寸。
 * @role    App.tsx 的纯策略层，防止 Menubar 切换覆盖用户调整过的 Desktop 几何。
 * @deps    无
 * @gotcha  运行中切换永远 resize=false；只有冷启动才从最后 Desktop 视图恢复持久尺寸。
 */
export type AppWindowViewMode = "list" | "cinema";

export interface AppModeWindowPolicy {
  viewMode: AppWindowViewMode;
  sizeMode: AppWindowViewMode;
  resize: boolean;
}

export const resolveAppModeWindowPolicy = ({
  nextMode,
  desktopMode,
  initial,
}: {
  nextMode: "desktop" | "menubar";
  desktopMode: AppWindowViewMode;
  initial: boolean;
}): AppModeWindowPolicy => ({
  viewMode: nextMode === "menubar" ? "list" : desktopMode,
  sizeMode: desktopMode,
  resize: initial,
});

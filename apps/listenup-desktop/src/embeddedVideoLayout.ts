/**
 * @purpose 计算 Embedded 视频专注模式在指定宽度下的窗口高度。
 * @role    App.tsx 的纯布局策略；让标题栏与 16:9 视频完整可见且可独立测试。
 * @deps    无。
 * @gotcha  width/headerHeight 都是 Tauri logical/CSS 像素；结果包含窗口壳的上下边框。
 */

export const EMBEDDED_VIDEO_ONLY_MIN_WIDTH = 340;

const VIDEO_ASPECT_HEIGHT_RATIO = 9 / 16;
const SHELL_VERTICAL_BORDER = 2;

export const embeddedVideoOnlyHeight = (
  width: number,
  headerHeight: number
) => {
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const safeHeaderHeight = Number.isFinite(headerHeight)
    ? Math.max(0, headerHeight)
    : 0;
  return Math.ceil(
    safeHeaderHeight + safeWidth * VIDEO_ASPECT_HEIGHT_RATIO + SHELL_VERTICAL_BORDER
  );
};

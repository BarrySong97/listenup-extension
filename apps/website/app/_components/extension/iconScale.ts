/**
 * @purpose 图标尺寸语义常量（扩展同名文件的副本）。
 * @role    本目录组件共用。
 * @deps    无
 * @gotcha  改扩展那份不会同步过来
 */
"use client";
export const iconScale = {
  headerAction: "h-5 w-5",
  primaryControl: "h-5 w-5",
  secondaryAction: "h-4 w-4",
  surface: "h-5 w-5",
  launcher: "h-6 w-6",
  canvasLauncher: "h-7 w-7",
  brand: "h-4 w-4",
} as const;

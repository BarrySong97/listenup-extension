/**
 * @purpose 图标尺寸的语义化常量表（headerAction / primaryControl / …）。
 * @role    被扩展各处图标按钮引用，保证同类位置尺寸一致。
 * @deps    无
 * @gotcha  website 的 app/_components/extension/iconScale.ts 是它的副本，不会自动同步
 */
export const iconScale = {
  headerAction: "h-5 w-5",
  primaryControl: "h-5 w-5",
  secondaryAction: "h-4 w-4",
  surface: "h-5 w-5",
  launcher: "h-6 w-6",
  canvasLauncher: "h-7 w-7",
  brand: "h-4 w-4",
} as const;

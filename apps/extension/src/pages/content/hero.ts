/**
 * @purpose HeroUI v2 主题定制：字号、行高、圆角、阴影与明暗色板。
 * @role    供 Tailwind 配置消费，决定内容脚本与扩展页面的整体观感。
 * @deps    @heroui/react 的 heroui()
 * @gotcha  扩展用 HeroUI v2，website 用 v3，两套主题互不通用；见 design.md
 */
import { heroui } from "@heroui/react";

export default heroui({
  layout: {
    fontSize: {
      tiny: "0.625rem",
      small: "0.75rem",
      medium: "0.875rem",
      large: "1rem",
    },
    lineHeight: {
      tiny: "0.875rem",
      small: "1rem",
      medium: "1.25rem",
      large: "1.5rem",
    },
    radius: {
      small: "0.375rem",
      medium: "0.5rem",
      large: "0.75rem",
    },
    borderWidth: {
      small: "1px",
      medium: "1px",
      large: "1px",
    },
    boxShadow: {
      small: "0 1px 2px 0 rgb(15 23 42 / 0.06)",
      medium: "0 10px 30px 0 rgb(15 23 42 / 0.10)",
      large: "0 20px 48px 0 rgb(15 23 42 / 0.16)",
    },
  },
  themes: {
    light: {
      colors: {
        default: {
          50: "#fafafa",
          100: "#f4f4f5",
          200: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#18181b",
          foreground: "#18181b",
          DEFAULT: "#f4f4f5",
        },
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          foreground: "#ffffff",
          DEFAULT: "#2563eb",
        },
        divider: "#e4e4e7",
        background: "#ffffff",
        foreground: "#18181b",
        content1: "#ffffff",
        content2: "#fafafa",
      },
    },
  },
});

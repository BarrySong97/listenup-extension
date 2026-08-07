/**
 * @purpose 为虚拟字幕列表提供无 React hover state 的轻量原生按钮语义。
 * @role    SubtitleRow 的高频交互 primitive；保留键盘、disabled 与无障碍能力。
 * @deps    react types
 * @gotcha  不得改用 HeroUI/React Aria Button；其 useHover state 会让逐行移入触发 React render。
 */
import type { ButtonHTMLAttributes } from "react";

export interface DesktopRowButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  isDisabled?: boolean;
}

export const DesktopRowButton = ({
  className = "",
  isDisabled = false,
  type = "button",
  ...props
}: DesktopRowButtonProps) => (
  <button
    type={type}
    disabled={isDisabled}
    className={`m-0 min-w-0 appearance-none border-0 bg-transparent p-0 outline-none ${className}`}
    {...props}
  />
);

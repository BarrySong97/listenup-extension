/**
 * @purpose 用 HeroUI Input 承载 Desktop 单行文本输入。
 * @role    业务组件与 React Aria 输入语义之间的统一边界。
 * @deps    @heroui/react、@tauri-apps/api/core
 * @gotcha  nonactivatingPanel 的 Command 快捷键需要在 pointer/focus 时显式激活 app；必须透传业务 onFocus。
 */
import { Input } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import type { ComponentProps } from "react";

export interface DesktopTextFieldProps
  extends Omit<ComponentProps<typeof Input>, "className"> {
  className?: string;
}

export const DesktopTextField = ({
  className = "",
  onFocus,
  onPointerDownCapture,
  ...props
}: DesktopTextFieldProps) => {
  const activate = () => {
    void invoke("activate_text_input");
  };

  return (
    <Input
      className={`m-0 min-w-0 appearance-none outline-none ${className}`}
      onPointerDownCapture={(event) => {
        activate();
        onPointerDownCapture?.(event);
      }}
      onFocus={(event) => {
        activate();
        onFocus?.(event);
      }}
      {...props}
    />
  );
};

/**
 * @purpose 用 HeroUI TextArea 承载不会回显明文的多行秘密输入。
 * @role    CookieSettings 的完整 Cookie 串粘贴边界。
 * @deps    @heroui/react、@tauri-apps/api/core
 * @gotcha  必须保留 WebKit text-security；nonactivatingPanel 的 Command 快捷键需要显式激活 app。
 */
import { TextArea } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import type { ComponentProps } from "react";

export interface DesktopSecretAreaProps
  extends Omit<ComponentProps<typeof TextArea>, "className"> {
  className?: string;
}

export const DesktopSecretArea = ({
  className = "",
  onFocus,
  onPointerDownCapture,
  ...props
}: DesktopSecretAreaProps) => {
  const activate = () => {
    void invoke("activate_text_input");
  };

  return (
    <TextArea
      autoComplete="off"
      spellCheck={false}
      className={`m-0 min-w-0 appearance-none outline-none [-webkit-text-security:disc] ${className}`}
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

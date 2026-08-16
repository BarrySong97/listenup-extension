/**
 * @purpose 用 HeroUI TextArea 承载不会回显明文的多行秘密输入。
 * @role    CookieSettings 的完整 Cookie 串粘贴边界。
 * @deps    @heroui/react
 * @gotcha  必须保留 WebKit text-security；主窗口输入走标准 NSWindow 焦点链路。
 */
import { TextArea } from "@heroui/react";
import type { ComponentProps } from "react";

export interface DesktopSecretAreaProps
  extends Omit<ComponentProps<typeof TextArea>, "className"> {
  className?: string;
}

export const DesktopSecretArea = ({
  className = "",
  ...props
}: DesktopSecretAreaProps) => {
  return (
    <TextArea
      autoComplete="off"
      spellCheck={false}
      className={`m-0 min-w-0 appearance-none outline-none [-webkit-text-security:disc] ${className}`}
      {...props}
    />
  );
};

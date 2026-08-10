/**
 * @purpose 用 HeroUI Input 承载 Desktop 单行文本输入。
 * @role    业务组件与 React Aria 输入语义之间的统一边界。
 * @deps    @heroui/react
 * @gotcha  业务层传具体样式与 aria label；不要退回无封装原生 input。
 */
import { Input } from "@heroui/react";
import type { ComponentProps } from "react";

export interface DesktopTextFieldProps
  extends Omit<ComponentProps<typeof Input>, "className"> {
  className?: string;
}

export const DesktopTextField = ({
  className = "",
  ...props
}: DesktopTextFieldProps) => (
  <Input
    className={`m-0 min-w-0 appearance-none outline-none ${className}`}
    {...props}
  />
);

/**
 * @purpose 用 HeroUI Button 承载 Desktop 中带可见文字的基础操作。
 * @role    作为业务组件与 HeroUI 之间的统一样式、事件和禁用语义边界。
 * @deps    @heroui/react
 * @gotcha  业务层仍提供具体尺寸和颜色；这里不引入会改变现有毛玻璃视觉的默认主题。
 */
import { Button } from "@heroui/react";
import type { ComponentProps } from "react";

export interface DesktopButtonProps
  extends Omit<ComponentProps<typeof Button>, "className"> {
  className?: string;
}

export const DesktopButton = ({
  className = "",
  type = "button",
  ...props
}: DesktopButtonProps) => (
  <Button
    type={type}
    variant="ghost"
    className={`m-0 min-w-0 appearance-none outline-none ${className}`}
    {...props}
  />
);

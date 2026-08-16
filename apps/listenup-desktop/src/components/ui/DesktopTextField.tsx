/**
 * @purpose 用 HeroUI Input 承载 Desktop 单行文本输入。
 * @role    业务组件与 React Aria 输入语义之间的统一边界。
 * @deps    React、@heroui/react
 * @gotcha  主窗口是标准 NSWindow；不要在输入 wrapper 里重新加入应用激活副作用。ref 必须落到原生 input，供 Modal 在布局完成后无滚动聚焦。
 */
import { Input } from "@heroui/react";
import { forwardRef, type ComponentProps } from "react";

export interface DesktopTextFieldProps
  extends Omit<ComponentProps<typeof Input>, "className" | "ref"> {
  className?: string;
}

export const DesktopTextField = forwardRef<
  HTMLInputElement,
  DesktopTextFieldProps
>(function DesktopTextField(
  { className = "", ...props },
  ref
) {
  return (
    <Input
      ref={ref}
      className={`m-0 min-w-0 appearance-none outline-none ${className}`}
      {...props}
    />
  );
});

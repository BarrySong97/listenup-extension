/**
 * @purpose 为 Desktop 纯图标操作统一提供 HeroUI Button、Tooltip 和无障碍名称。
 * @role    标题栏、字幕控制行与影院工具条共用的图标按钮基础组件。
 * @deps    @heroui/react、react
 * @gotcha  必须显式使用 HeroUI Tooltip.Trigger；disabled button 自身收不到事件，保留内层 span 承接 hover/focus。
 */
import { Button, Tooltip } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";

type TooltipPlacement = ComponentProps<typeof Tooltip.Content>["placement"];

export interface DesktopIconButtonProps
  extends Omit<
    ComponentProps<typeof Button>,
    "aria-label" | "children" | "className" | "isIconOnly"
  > {
  ariaLabel: string;
  className?: string;
  icon: ReactNode;
  tooltip: string;
  tooltipPlacement?: TooltipPlacement;
  wrapperClassName?: string;
}

export const DesktopIconButton = ({
  ariaLabel,
  className = "",
  icon,
  isDisabled = false,
  tooltip,
  tooltipPlacement = "bottom",
  wrapperClassName = "",
  type = "button",
  ...props
}: DesktopIconButtonProps) => (
  <Tooltip delay={350} closeDelay={80}>
    <Tooltip.Trigger>
      <span
        className={`inline-flex flex-none ${wrapperClassName}`}
        tabIndex={isDisabled ? 0 : undefined}
        aria-label={isDisabled ? ariaLabel : undefined}
      >
        <Button
          type={type}
          variant="ghost"
          isIconOnly
          isDisabled={isDisabled}
          aria-label={ariaLabel}
          className={`m-0 min-w-0 appearance-none p-0 outline-none ${className}`}
          {...props}
        >
          {icon}
        </Button>
      </span>
    </Tooltip.Trigger>
    <Tooltip.Content
      placement={tooltipPlacement}
      className="z-[100] max-w-[220px] rounded-md border border-white/10 bg-[#28282c] px-2 py-1 text-[10px] font-medium leading-[1.3] text-fg shadow-lg"
    >
      {tooltip}
    </Tooltip.Content>
  </Tooltip>
);

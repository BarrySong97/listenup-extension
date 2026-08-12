/**
 * @purpose 统一 Desktop 的 HeroUI v3 底部 Modal、视觉 token、Mask 关闭、窗口拖拽与滑入动画入口。
 * @role    业务弹窗只组合内容，不再手写全屏遮罩、焦点锁、Esc 或 aria-modal 语义。
 * @deps    @heroui/react、@tauri-apps/api/window、React
 * @gotcha  Modal 会把底层 App 设为 inert；窗口拖拽区必须放在 Portal 内，不能只依赖底层 Header。
 */
import { Modal } from "@heroui/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRef, type ComponentProps, type ReactNode } from "react";

type ModalContainerProps = ComponentProps<typeof Modal.Container>;

interface DesktopModalProps {
  isOpen: boolean;
  children: ReactNode;
  onClose: () => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  size?: ModalContainerProps["size"];
  placement?: ModalContainerProps["placement"];
  scroll?: ModalContainerProps["scroll"];
  isDismissable?: boolean;
  isKeyboardDismissDisabled?: boolean;
  backdropClassName?: string;
  containerClassName?: string;
  dialogClassName?: string;
}

const classes = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(" ");

export const DesktopModal = ({
  isOpen,
  children,
  onClose,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  size = "sm",
  placement = "bottom",
  scroll = "inside",
  isDismissable = true,
  isKeyboardDismissDisabled = false,
  backdropClassName,
  containerClassName,
  dialogClassName,
}: DesktopModalProps) => {
  const suppressDismissUntilRef = useRef(0);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Modal.Backdrop
        variant="transparent"
        isDismissable={false}
        isKeyboardDismissDisabled={isKeyboardDismissDisabled}
        className={classes(
          "desktop-modal-backdrop z-[70] overflow-hidden rounded-2xl"
        )}
        onClick={(event) => {
          if (!isDismissable) return;
          if (performance.now() < suppressDismissUntilRef.current) return;
          const target = event.target as HTMLElement;
          if (
            target.closest?.(
              '[data-slot="modal-dialog"], [data-desktop-modal-drag-region]'
            )
          ) {
            return;
          }
          onClose();
        }}
      >
        <div
          className={classes(
            "absolute inset-x-0 bottom-0 top-11 bg-glass/95 backdrop-blur-xl",
            backdropClassName
          )}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 z-[80] h-11"
          data-desktop-modal-drag-region
          data-tauri-drag-region
          aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            suppressDismissUntilRef.current = performance.now() + 750;
            event.preventDefault();
            event.stopPropagation();
            void getCurrentWindow().startDragging();
          }}
          onClick={(event) => event.stopPropagation()}
        />
        <Modal.Container
          placement={placement}
          scroll={scroll}
          size={size}
          className={classes(
            "desktop-modal-container p-5 sm:p-5",
            containerClassName
          )}
        >
          <Modal.Dialog
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
            className={classes(
              "rounded-xl border border-hairline bg-modal p-4 shadow-2xl",
              dialogClassName
            )}
          >
            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

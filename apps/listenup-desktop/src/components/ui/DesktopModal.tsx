/**
 * @purpose 统一 Desktop 的 HeroUI v3 底部 Modal、视觉 token、完整 Mask 关闭与滑入动画入口。
 * @role    业务弹窗只组合内容，不再手写全屏遮罩、焦点锁、Esc 或 aria-modal 语义。
 * @deps    @heroui/react、React
 * @gotcha  Modal 打开时完整 Mask 覆盖 Header，不支持拖窗；关闭 Modal 后再由原 Header 拖动窗口。
 */
import { Modal } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";

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
}: DesktopModalProps) => (
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
        "desktop-modal-backdrop overflow-hidden rounded-2xl bg-glass/95 backdrop-blur-xl",
        backdropClassName
      )}
      onPointerDownCapture={(event) => {
        if (!isDismissable) return;
        const target = event.target as HTMLElement;
        if (target.closest?.('[data-slot="modal-dialog"]')) {
          return;
        }
        onClose();
      }}
    >
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

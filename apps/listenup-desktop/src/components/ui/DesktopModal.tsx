/**
 * @purpose 统一 Desktop 的 HeroUI v3 Modal 结构、视觉 token 与底部滑入动画入口。
 * @role    业务弹窗只组合内容，不再手写全屏遮罩、焦点锁、Esc 或 aria-modal 语义。
 * @deps    @heroui/react、@tauri-apps/api/core、React
 * @gotcha  HeroUI v3 不再支持 motionProps；动画必须由 styles.css 覆盖 data-entering/data-exiting。
 */
import { Modal } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
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
  placement = "center",
  scroll = "inside",
  isDismissable = false,
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
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      className={classes(
        "desktop-modal-backdrop overflow-hidden rounded-2xl bg-glass/95 backdrop-blur-xl",
        backdropClassName
      )}
      onPointerDownCapture={() => {
        void invoke("activate_text_input");
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
            "rounded-xl border border-hairline bg-glass p-4 shadow-2xl",
            dialogClassName
          )}
        >
          {children}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  </Modal>
);

import { FC, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { iconScale } from "@src/components/ui/iconScale";
import { AiSettingsForm } from "@src/components/ai/AiSettingsForm";

interface AiSettingsCardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiSettingsCard: FC<AiSettingsCardProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const headerActionButtonClassName =
    "h-9 w-9 min-w-0 rounded-md p-0 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 data-[hover=true]:bg-zinc-100 data-[hover=true]:text-zinc-900";

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="ai-settings-card"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-y-0 right-0 z-40 flex w-full max-w-[30em] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_24px_48px_rgba(15,23,42,0.22)]"
        >
          <div className="flex items-start justify-between gap-2 border-b border-zinc-200 px-4 pt-3 pb-3">
            <div className="min-w-0 flex-1">
              <div className="text-xl font-bold leading-tight text-zinc-900">
                AI Settings
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Configure the AI provider used by Explain and choose the image
                source for visual references.
              </p>
            </div>
            <Button
              isIconOnly
              size="md"
              variant="light"
              className={headerActionButtonClassName}
              onPressStart={onClose}
              aria-label="Close"
            >
              <Icon icon="mdi:close" className={iconScale.headerAction} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <AiSettingsForm sectionClassName="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 shadow-none" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
